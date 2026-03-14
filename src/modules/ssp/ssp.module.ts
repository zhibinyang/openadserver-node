/**
 * SSP Module
 * Provides SSP (Supply-Side Platform) connector functionality
 */

import { Module, Global } from '@nestjs/common';
import { SspRegistry } from './ssp-registry.service';
import { MockSspAdapter } from './adapters/mock-ssp.adapter';
import { SspController } from './ssp.controller';
import { RtbModule } from '../rtb/rtb.module';

@Global()
@Module({
  imports: [RtbModule],
  controllers: [SspController],
  providers: [
    SspRegistry,
    MockSspAdapter,
    {
      provide: 'SSP_ADAPTERS',
      useFactory: (registry: SspRegistry, mockAdapter: MockSspAdapter) => {
        // Register mock adapter by default
        registry.registerAdapter(mockAdapter, {
          id: 'mock-ssp',
          name: 'Mock SSP',
          enabled: true,
        });
        return registry;
      },
      inject: [SspRegistry, MockSspAdapter],
    },
  ],
  exports: [SspRegistry],
})
export class SspModule {}
