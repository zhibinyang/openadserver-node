import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
    imports: [
        DatabaseModule,
        RedisModule,
        AnalyticsModule,
    ],
    controllers: [TrackingController],
    providers: [TrackingService],
})
export class TrackingModule { }
