import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { CourierModule } from '../couriers/courier.module';
import { OrdersController } from './orders.controller';
import { BatchController } from './batch.controller';
import { OrdersService } from './orders.service';
import { BulkOrderProcessor } from './bulk-order.processor';

@Module({
  imports: [
    CourierModule,

    BullModule.registerQueue({
      name: 'bulk-orders',
    }),
  ],

  controllers: [
    OrdersController,
    BatchController,
  ],

  providers: [
    OrdersService,
    BulkOrderProcessor,
  ],
})
export class OrdersModule {}
