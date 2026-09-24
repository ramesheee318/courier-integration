import { Injectable } from '@nestjs/common';
import { CourierAdapter } from './courier.interface';

@Injectable()
export class CourierRegistry {
  private readonly adapters =
    new Map<string, CourierAdapter>();

  register(adapter: CourierAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): CourierAdapter {
    const adapter = this.adapters.get(name);

    if (!adapter) {
      throw new Error(
        `Unknown courier partner: ${name}`,
      );
    }

    return adapter;
  }

  getSupportedCouriers(): string[] {
    return [...this.adapters.keys()];
  }
}
