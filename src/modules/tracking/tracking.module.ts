import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { RedisModule } from '../../shared/redis/redis.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
    imports: [
        RedisModule,
        AnalyticsModule,
    ],
    controllers: [TrackingController],
    providers: [TrackingService],
})
export class TrackingModule { }
