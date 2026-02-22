import { Module, forwardRef } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { RedisModule } from '../../shared/redis/redis.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EngineModule } from '../engine/engine.module'; // Import EngineModule to access CalibrationService

@Module({
    imports: [
        RedisModule,
        AnalyticsModule,
        forwardRef(() => EngineModule), // Optional if circular, but Engine doesn't import Tracking right now
    ],
    controllers: [TrackingController],
    providers: [TrackingService],
})
export class TrackingModule { }
