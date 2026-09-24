export interface NormalizedAddress {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface NormalizedCreateShipmentRequest {
  orderId: string;

  pickup: NormalizedAddress;

  delivery: NormalizedAddress;

  package: {
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    pieces?: number;
    itemDescription?: string;
  };

  payment: {
    type: 'PREPAID' | 'COD';
    amount: number;
  };

  invoice: {
    number: string;
    date: string;
    value: number;
  };
}

export interface CourierCreateShipmentResult {
  courierOrderId: string;
  awbNumber: string;
  status: string;
  rawRequest?: unknown;
  rawResponse: unknown;
}

export interface CourierTrackingResult {
  status: string;
  awbNumber?: string;
  rawResponse: unknown;
}

export interface CourierCancelResult {
  success: boolean;
  rawResponse: unknown;
}

export interface CourierAdapter {
  readonly name: string;

  authenticate(): Promise<void>;

  createShipment(
    request: NormalizedCreateShipmentRequest,
  ): Promise<CourierCreateShipmentResult>;

  trackShipment(
    shipmentId: string,
  ): Promise<CourierTrackingResult>;

  cancelShipment(
    shipmentId: string,
  ): Promise<CourierCancelResult>;
}
