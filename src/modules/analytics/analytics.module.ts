
import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';

@Module({
    imports: [DatabaseModule, RedisModule],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
