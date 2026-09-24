import { Injectable } from '@nestjs/common';
import {
  CourierAdapter,
  CourierCancelResult,
  CourierCreateShipmentResult,
  CourierTrackingResult,
  NormalizedCreateShipmentRequest,
} from '../courier.interface';
import { UrbaneBoltClient } from './urbanebolt.client';
import { UrbaneBoltMapper } from './urbanebolt.mapper';

@Injectable()
export class UrbaneBoltAdapter implements CourierAdapter {
  readonly name = 'urbanebolt';

  constructor(
    private readonly client: UrbaneBoltClient,
    private readonly mapper: UrbaneBoltMapper,
  ) {}

  async authenticate(): Promise<void> {
    await this.client.authenticate();
  }

  async createShipment(
    request: NormalizedCreateShipmentRequest,
  ): Promise<CourierCreateShipmentResult> {
    const payload = this.mapper.toManifestPayload(request);

    const response = await this.client.manifest(payload);

    const responseData = response as any;

    const successResponse =
      responseData?.successResponse ?? [];

    const errorResponse =
      responseData?.errorResponse ?? [];

    if (
      errorResponse.length > 0 ||
      successResponse.length === 0
    ) {
      const message =
        errorResponse
          .map((item: any) => item.message)
          .filter(Boolean)
          .join('; ') ||
        'UrbaneBolt rejected the shipment';

      throw new Error(message);
    }

    const shipment = successResponse[0];

    return {
      courierOrderId: String(
        shipment?.orderNumber ?? request.orderId,
      ),

      awbNumber: String(
        shipment?.awbNumber ??
        shipment?.awb ??
        shipment?.awb_number ??
        '',
      ),

      status: shipment?.status ?? 'CREATED',

      rawRequest: payload,

      rawResponse: response,
    };
  }

  async trackShipment(
    shipmentId: string,
  ): Promise<CourierTrackingResult> {
    const response =
      await this.client.tracking(shipmentId);

    const responseData = response as any;

    return {
      status:
        responseData?.status ??
        responseData?.currentStatus ??
        responseData?.shipmentStatus ??
        'IN_TRANSIT',

      awbNumber: shipmentId,

      rawResponse: response,
    };
  }

  async cancelShipment(
    shipmentId: string,
  ): Promise<CourierCancelResult> {
    const response =
      await this.client.cancel(shipmentId);

    return {
      success: true,
      rawResponse: response,
    };
  }
}
