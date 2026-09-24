import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import { OrdersService } from './orders.service';

@Controller('batches')
export class BatchController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @Get(':batchId')
  async getBatch(
    @Param('batchId') batchId: string,
  ) {
    return this.ordersService.getBatch(batchId);
  }
}
