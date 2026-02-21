
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RedisModule } from '../../shared/redis/redis.module';

@Module({
    imports: [DatabaseModule, RedisModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }
