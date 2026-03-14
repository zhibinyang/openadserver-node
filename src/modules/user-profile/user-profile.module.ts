import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { EngineModule } from '../engine/engine.module';
import { UserProfileController } from './user-profile.controller';
import { SegmentController } from './segment.controller';
import { UserProfileService } from '../engine/services/user-profile.service';

@Module({
    imports: [DatabaseModule, RedisModule, EngineModule],
    controllers: [UserProfileController, SegmentController],
    providers: [UserProfileService],
    exports: [UserProfileService],
})
export class UserProfileModule { }
