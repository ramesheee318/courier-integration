import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { CourierRegistry } from '../couriers/courier.registry';
import {
  NormalizedCreateShipmentRequest,
} from '../couriers/courier.interface';

import { CreateOrderDto } from './dto/create-order.dto';
import { BulkOrdersDto } from './dto/bulk-orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courierRegistry: CourierRegistry,

    @InjectQueue('bulk-orders')
    private readonly bulkQueue: Queue,
  ) {}

  // ============================================================
  // CREATE SINGLE ORDER
  // ============================================================

  async createOrder(
    dto: CreateOrderDto,
    requestId?: string,
  ) {
    const existingOrder =
      await this.prisma.order.findUnique({
        where: {
          orderId: dto.order_id,
        },
      });

    if (existingOrder) {
      return {
        success: true,
        data: {
          order_id: existingOrder.orderId,
          courier_partner: existingOrder.courierPartner,
          courier_order_id: existingOrder.courierOrderId,
          awb_number: existingOrder.awbNumber,
          status: existingOrder.status,
        },
        request_id: requestId,
        idempotent: true,
      };
    }

    let courier;

    try {
      courier = this.courierRegistry.get(
        dto.courier_partner,
      );
    } catch {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'UNKNOWN_COURIER',
          message: `Unsupported courier partner: ${dto.courier_partner}`,
          supported_couriers:
            this.courierRegistry.getSupportedCouriers(),
        },
        request_id: requestId,
      });
    }

    const normalizedRequest:
      NormalizedCreateShipmentRequest = {
      orderId: dto.order_id,

      pickup: {
        name: dto.pickup.name,
        phone: dto.pickup.phone,
        email: dto.pickup.email,
        address: dto.pickup.address,
        city: dto.pickup.city,
        state: dto.pickup.state,
        country: dto.pickup.country,
        pincode: dto.pickup.pincode,
      },

      delivery: {
        name: dto.delivery.name,
        phone: dto.delivery.phone,
        email: dto.delivery.email,
        address: dto.delivery.address,
        city: dto.delivery.city,
        state: dto.delivery.state,
        country: dto.delivery.country,
        pincode: dto.delivery.pincode,
      },

      package: {
        weight: dto.package.weight,
        length: dto.package.length,
        width: dto.package.width,
        height: dto.package.height,
        pieces: dto.package.pieces,
        itemDescription:
          dto.package.item_description,
      },

      payment: {
        type: dto.payment.type,
        amount: dto.payment.amount,
      },

      invoice: {
        number: dto.invoice.number,
        date: dto.invoice.date,
        value: dto.invoice.value,
      },
    };

    const courierResult =
      await courier.createShipment(
        normalizedRequest,
      );

    const status =
      this.normalizeShipmentStatus(
        courierResult.status,
      );

    const order =
      await this.prisma.order.create({
        data: {
          orderId: dto.order_id,

          courierPartner:
            dto.courier_partner,

          courierOrderId:
            courierResult.courierOrderId,

          awbNumber:
            courierResult.awbNumber || null,

          status,

          requestPayload:
            (courierResult.rawRequest ??
              normalizedRequest) as Prisma.InputJsonValue,

          responsePayload:
            courierResult.rawResponse as Prisma.InputJsonValue,

          trackingHistory: {
            create: {
              status,
              rawPayload:
                courierResult.rawResponse as Prisma.InputJsonValue,
              eventTimestamp: new Date(),
            },
          },
        },

        include: {
          trackingHistory: true,
        },
      });

    return {
      success: true,
      data: {
        order_id: order.orderId,
        courier_partner:
          order.courierPartner,
        courier_order_id:
          order.courierOrderId,
        awb_number:
          order.awbNumber,
        status: order.status,
      },
      request_id: requestId,
    };
  }

  // ============================================================
  // GET ORDER
  // ============================================================

  async getOrder(orderId: string) {
    const order =
      await this.prisma.order.findUnique({
        where: {
          orderId,
        },
      });

    if (!order) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Order not found: ${orderId}`,
        },
      });
    }

    return {
      success: true,
      data: {
        order_id: order.orderId,
        courier_partner:
          order.courierPartner,
        courier_order_id:
          order.courierOrderId,
        awb_number:
          order.awbNumber,
        status: order.status,
        created_at:
          order.createdAt,
        updated_at:
          order.updatedAt,
      },
    };
  }

  // ============================================================
  // TRACK ORDER
  // ============================================================

  async trackOrder(
    orderId: string,
    requestId?: string,
  ) {
    const order =
      await this.prisma.order.findUnique({
        where: {
          orderId,
        },
      });

    if (!order) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Order not found: ${orderId}`,
        },
        request_id: requestId,
      });
    }

    if (!order.awbNumber) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'AWB_NOT_AVAILABLE',
          message:
            'AWB number is not available for this order',
        },
        request_id: requestId,
      });
    }

    let courier;

    try {
      courier =
        this.courierRegistry.get(
          order.courierPartner,
        );
    } catch {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'UNKNOWN_COURIER',
          message:
            `Unsupported courier partner: ${order.courierPartner}`,
          supported_couriers:
            this.courierRegistry.getSupportedCouriers(),
        },
        request_id: requestId,
      });
    }

    // IMPORTANT:
    // UrbaneBolt tracking requires AWB.
    const trackingResult =
      await courier.trackShipment(
        order.awbNumber,
      );

    const status =
      this.normalizeShipmentStatus(
        trackingResult.status,
      );

    await this.prisma.order.update({
      where: {
        orderId,
      },
      data: {
        status,
      },
    });

    await this.prisma.trackingHistory.create({
      data: {
        orderId: order.id,

        status,

        rawPayload:
          trackingResult.rawResponse as Prisma.InputJsonValue,

        eventTimestamp: new Date(),
      },
    });

    return {
      success: true,
      data: {
        order_id: order.orderId,

        courier_partner:
          order.courierPartner,

        courier_order_id:
          order.courierOrderId,

        awb_number:
          order.awbNumber,

        status,
      },
      request_id: requestId,
    };
  }

  // ============================================================
  // CANCEL ORDER
  // ============================================================

  async cancelOrder(
    orderId: string,
    requestId?: string,
  ) {
    const order =
      await this.prisma.order.findUnique({
        where: {
          orderId,
        },
      });

    if (!order) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Order not found: ${orderId}`,
        },
        request_id: requestId,
      });
    }

    if (!order.awbNumber) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'AWB_NOT_AVAILABLE',
          message:
            'AWB number is not available for cancellation',
        },
        request_id: requestId,
      });
    }

    const courier =
      this.courierRegistry.get(
        order.courierPartner,
      );

    // UrbaneBolt cancellation requires AWB.
    const result =
      await courier.cancelShipment(
        order.awbNumber,
      );

    await this.prisma.order.update({
      where: {
        orderId,
      },
      data: {
        status: 'CANCELLED',
      },
    });

    await this.prisma.trackingHistory.create({
      data: {
        orderId: order.id,

        status: 'CANCELLED',

        rawPayload:
          result.rawResponse as Prisma.InputJsonValue,

        eventTimestamp: new Date(),
      },
    });

    return {
      success: true,
      data: {
        order_id: order.orderId,

        courier_partner:
          order.courierPartner,

        courier_order_id:
          order.courierOrderId,

        awb_number:
          order.awbNumber,

        status: 'CANCELLED',
      },
      request_id: requestId,
    };
  }

  // ============================================================
  // BULK ORDERS
  // ============================================================

  async createBulkOrders(
    dto: BulkOrdersDto,
    requestId?: string,
  ) {
    const batch =
      await this.prisma.batch.create({
        data: {
          total: dto.orders.length,
          status: 'PROCESSING',
        },
      });

    await this.prisma.batchJob.createMany({
      data: dto.orders.map((order) => ({
        batchId: batch.id,
        orderId: order.order_id,
        status: 'PROCESSING',
      })),
      skipDuplicates: true,
    });

    for (const order of dto.orders) {
      await this.bulkQueue.add(
        'create-order',
        {
          order,
          batchId: batch.id,
          requestId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }

    return {
      success: true,
      data: {
        batch_id: batch.id,
        total: dto.orders.length,
        status: 'PROCESSING',
      },
      request_id: requestId,
    };
  }

  // ============================================================
  // BULK JOB PROCESSING
  // ============================================================

  async processBulkOrder(
    order: CreateOrderDto,
    batchId: string,
    requestId?: string,
  ) {
    try {
      await this.createOrder(
        order,
        requestId,
      );

      await this.prisma.batchJob.update({
        where: {
          batchId_orderId: {
            batchId,
            orderId: order.order_id,
          },
        },
        data: {
          status: 'SUCCESS',
          errorCode: null,
          errorMsg: null,
        },
      });
    } catch (error) {
      let errorCode =
        'ORDER_PROCESSING_FAILED';

      let errorMessage =
        'Order processing failed';

      if (
        error instanceof BadRequestException
      ) {
        const response =
          error.getResponse();

        if (
          typeof response === 'object' &&
          response !== null &&
          'error' in response
        ) {
          const errorData =
            (response as any).error;

          if (
            errorData?.code &&
            errorData?.message
          ) {
            errorCode =
              String(errorData.code);

            errorMessage =
              String(errorData.message);
          }
        }
      } else if (
        error instanceof Error
      ) {
        errorMessage = error.message;
      }

      await this.prisma.batchJob.update({
        where: {
          batchId_orderId: {
            batchId,
            orderId: order.order_id,
          },
        },
        data: {
          status: 'FAILED',
          errorCode,
          errorMsg: errorMessage,
        },
      });

      // Re-throw so BullMQ can retry.
      throw error;
    } finally {
      await this.updateBatchCounters(
        batchId,
      );
    }
  }

  // ============================================================
  // BATCH STATUS
  // ============================================================

  async getBatch(batchId: string) {
    const batch =
      await this.prisma.batch.findUnique({
        where: {
          id: batchId,
        },
        include: {
          jobs: true,
        },
      });

    if (!batch) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message:
            `Batch not found: ${batchId}`,
        },
      });
    }

    return {
      success: true,
      data: {
        batch_id: batch.id,
        status: batch.status,
        total: batch.total,
        successful: batch.successful,
        failed: batch.failed,
        jobs: batch.jobs,
      },
    };
  }

  // ============================================================
  // UPDATE BATCH COUNTERS
  // ============================================================

  private async updateBatchCounters(
    batchId: string,
  ) {
    const jobs =
      await this.prisma.batchJob.findMany({
        where: {
          batchId,
        },
      });

    const successful =
      jobs.filter(
        (job) => job.status === 'SUCCESS',
      ).length;

    const failed =
      jobs.filter(
        (job) => job.status === 'FAILED',
      ).length;

    let status:
      | 'PROCESSING'
      | 'COMPLETED'
      | 'PARTIALLY_COMPLETED'
      | 'FAILED' =
      'PROCESSING';

    if (
      successful + failed === jobs.length
    ) {
      if (
        successful === jobs.length
      ) {
        status = 'COMPLETED';
      } else if (
        failed === jobs.length
      ) {
        status = 'FAILED';
      } else {
        status = 'PARTIALLY_COMPLETED';
      }
    }

    await this.prisma.batch.update({
      where: {
        id: batchId,
      },
      data: {
        successful,
        failed,
        status,
      },
    });
  }

  // ============================================================
  // STATUS NORMALIZATION
  // ============================================================

  private normalizeShipmentStatus(
    status: string,
  ): ShipmentStatus {
    const normalized =
      status
        ?.toUpperCase()
        ?.trim();

    const statusMap:
      Record<string, ShipmentStatus> = {
      CREATED: 'CREATED',

      PICKED_UP: 'PICKED_UP',

      PICKUP: 'PICKED_UP',

      IN_TRANSIT: 'IN_TRANSIT',

      OUT_FOR_DELIVERY:
        'OUT_FOR_DELIVERY',

      DELIVERED: 'DELIVERED',

      CANCELLED: 'CANCELLED',

      CANCELED: 'CANCELLED',

      FAILED: 'FAILED',
    };

    return (
      statusMap[normalized] ??
      'IN_TRANSIT'
    );
  }
}
