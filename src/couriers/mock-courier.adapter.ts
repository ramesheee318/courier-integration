import { Injectable } from '@nestjs/common';

import {
  CourierAdapter,
  CourierCancelResult,
  CourierCreateShipmentResult,
  CourierTrackingResult,
  NormalizedCreateShipmentRequest,
} from './courier.interface';

@Injectable()
export class MockCourierAdapter
  implements CourierAdapter
{
  readonly name = 'mock';

  async authenticate(): Promise<void> {
    return;
  }

  async createShipment(
    request: NormalizedCreateShipmentRequest,
  ): Promise<CourierCreateShipmentResult> {
    return {
      courierOrderId:
        `MOCK-${request.orderId}`,

      awbNumber:
        `MOCK-AWB-${request.orderId}`,

      status: 'CREATED',

      rawResponse: {
        success: true,
        order_id: request.orderId,
      },
    };
  }

  async trackShipment(
    shipmentId: string,
  ): Promise<CourierTrackingResult> {
    return {
      status: 'IN_TRANSIT',

      awbNumber: shipmentId,

      rawResponse: {
        shipment_id: shipmentId,
        status: 'IN_TRANSIT',
      },
    };
  }

  async cancelShipment(
    shipmentId: string,
  ): Promise<CourierCancelResult> {
    return {
      success: true,

      rawResponse: {
        shipment_id: shipmentId,
        cancelled: true,
      },
    };
  }
}
