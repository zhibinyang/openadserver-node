
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
    imports: [DatabaseModule, RedisModule],
    controllers: [TrackingController],
    providers: [TrackingService],
})
export class TrackingModule { }
