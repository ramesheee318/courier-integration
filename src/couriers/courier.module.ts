import { Module } from '@nestjs/common';
import { CourierRegistry } from './courier.registry';
import { CourierRetryService } from './courier-retry.service';
import { MockCourierAdapter } from './mock-courier.adapter';
import { UrbaneBoltAdapter } from './urbanebolt/urbanebolt.adapter';
import { UrbaneBoltClient } from './urbanebolt/urbanebolt.client';
import { UrbaneBoltMapper } from './urbanebolt/urbanebolt.mapper';

@Module({
  providers: [
    CourierRegistry,
    CourierRetryService,

    MockCourierAdapter,

    UrbaneBoltClient,
    UrbaneBoltMapper,
    UrbaneBoltAdapter,

    {
      provide: 'COURIER_REGISTRY_INIT',
      inject: [
        CourierRegistry,
        MockCourierAdapter,
        UrbaneBoltAdapter,
      ],
      useFactory: (
        registry: CourierRegistry,
        mockCourier: MockCourierAdapter,
        urbaneBolt: UrbaneBoltAdapter,
      ) => {
        registry.register(mockCourier);
        registry.register(urbaneBolt);
      },
    },
  ],
  exports: [
    CourierRegistry,
    CourierRetryService,
  ],
})
export class CourierModule {}
