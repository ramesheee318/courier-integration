import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { BulkOrdersDto } from './dto/bulk-orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  async createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.ordersService.createOrder(
      dto,
      requestId,
    );
  }

  @Get(':orderId')
  async getOrder(
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getOrder(orderId);
  }

  @Get(':orderId/track')
  async trackOrder(
    @Param('orderId') orderId: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.ordersService.trackOrder(orderId, requestId);
  }

@Post(':orderId/cancel')
async cancelOrder(
  @Param('orderId') orderId: string,
  @Headers('x-request-id') requestId?: string,
) {
  return this.ordersService.cancelOrder(orderId, requestId);
}

@Post('bulk')
async createBulkOrders(
  @Body() dto: BulkOrdersDto,
  @Headers('x-request-id') requestId?: string,
) {
  return this.ordersService.createBulkOrders(
    dto,
    requestId,
  );
}

}


