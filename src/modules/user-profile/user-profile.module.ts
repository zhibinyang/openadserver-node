import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { EngineModule } from '../engine/engine.module';
import { UserProfileController } from './user-profile.controller';
import { SegmentController } from './segment.controller';
import { UserProfileService } from '../engine/services/user-profile.service';
import { SegmentService } from '../engine/services/segment.service';

@Module({
    imports: [DatabaseModule, RedisModule, EngineModule],
    controllers: [UserProfileController, SegmentController],
    providers: [UserProfileService, SegmentService],
    exports: [UserProfileService, SegmentService],
})
export class UserProfileModule { }
