
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { CacheService } from './services/cache.service';

@Module({
    imports: [
        DatabaseModule,
        ScheduleModule.forRoot(),
    ],
    providers: [CacheService],
    exports: [CacheService],
})
export class EngineModule { }
