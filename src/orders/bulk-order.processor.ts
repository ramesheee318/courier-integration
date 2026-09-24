import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { OrdersService } from './orders.service';

@Processor('bulk-orders')
export class BulkOrderProcessor extends WorkerHost {
  constructor(
    private readonly ordersService: OrdersService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const {
      order,
      batchId,
      requestId,
    } = job.data;

    try {
      await this.ordersService.processBulkOrder(
        order,
        batchId,
        requestId,
      );
    } catch (error) {
      console.error(
        `Bulk job failed: ${job.id}`,
        error,
      );

      throw error;
    }
  }
}
