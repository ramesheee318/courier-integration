import { Injectable } from '@nestjs/common';
import { NormalizedCreateShipmentRequest } from '../courier.interface';

@Injectable()
export class UrbaneBoltMapper {
  toManifestPayload(
    request: NormalizedCreateShipmentRequest,
  ): Record<string, unknown>[] {
    const itemDescription =
      request.package.itemDescription ?? 'GENERAL';

    const pieces =
      request.package.pieces ?? 1;

    const collectableValue =
      request.payment.type === 'COD'
        ? request.payment.amount
        : 0;

    const payMode =
      request.payment.type === 'PREPAID'
        ? 'PPD'
        : 'COD';

    return [
      {
        customerCode: 'UEBCUS0008',

        orderNumber: request.orderId,

        declaredValue: request.invoice.value,

        itemDescription,

        collectableValue,

        height: request.package.height ?? 1,

        length: request.package.length ?? 1,

        pieces,

        weight: request.package.weight,

        breadth: request.package.width ?? 1,

        serviceType: 'SDD',

        payMode,

        rtnCity: request.pickup.city,

        rtnName: request.pickup.name,

        rtnEmail: request.pickup.email,

        rtnState: request.pickup.state,

        rtnMobile: Number(request.pickup.phone),

        rtnAddress: request.pickup.address,

        rtnAddressType: 'Seller',

        rtnCountry: request.pickup.country,

        rtnPincode: Number(request.pickup.pincode),

        shprCity: request.pickup.city,

        shprName: request.pickup.name,

        shprEmail: request.pickup.email,

        shprState: request.pickup.state,

        shprMobile: Number(request.pickup.phone),

        shprAddress: request.pickup.address,

        shprAddressType: 'Seller',

        shprCountry: request.pickup.country,

        shprPincode: Number(request.pickup.pincode),

        consCity: request.delivery.city,

        consName: request.delivery.name,

        consEmail: request.delivery.email,

        consState: request.delivery.state,

        consMobile: Number(request.delivery.phone),

        consAddress: request.delivery.address,

        consAddressType: 'Home',

        consCountry: request.delivery.country,

        consPincode: Number(request.delivery.pincode),

        invoiceNumber: request.invoice.number,

        invoiceDate: request.invoice.date,

        invoiceValue: request.invoice.value,

        itemQuantity: pieces,
      },
    ];
  }
}
