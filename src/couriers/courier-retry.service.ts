import { Injectable } from '@nestjs/common';

import { CourierError } from './courier.error';

@Injectable()
export class CourierRetryService {
  async execute<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 500,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof CourierError)) {
          throw error;
        }

        const retryable =
          error.type === 'SERVER_ERROR' ||
          error.type === 'TIMEOUT' ||
          error.type === 'NETWORK_ERROR';

        if (!retryable || attempt >= maxRetries) {
          throw error;
        }

        const delay =
          baseDelayMs * Math.pow(2, attempt);

        await this.sleep(delay);

        attempt++;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(resolve, ms),
    );
  }
}
