import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from '../engine/services/user-profile.service';

@Module({
    imports: [DatabaseModule, RedisModule],
    controllers: [UserProfileController],
    providers: [UserProfileService],
    exports: [UserProfileService],
})
export class UserProfileModule { }
