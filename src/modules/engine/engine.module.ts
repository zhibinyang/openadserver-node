import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../shared/redis/redis.module';
import { CacheService } from './services/cache.service';
import { TargetingMatcher } from './services/targeting.matcher';
import { RetrievalService } from './pipeline/1-retrieval.service';
import { FilterService } from './pipeline/2-filter.service';
import { PredictionService } from './pipeline/3-prediction.service';
import { RankingService } from './pipeline/4-ranking.service';
import { RerankService } from './pipeline/5-rerank.service';
import { AdEngine } from './ad-engine.service';

@Module({
    imports: [
        DatabaseModule,
        RedisModule,
        ScheduleModule.forRoot(),
    ],
    providers: [
        CacheService,
        TargetingMatcher,
        // Pipeline Steps
        RetrievalService,
        FilterService,
        PredictionService,
        RankingService,
        RerankService,
        // Engine
        AdEngine,
    ],
    exports: [CacheService, AdEngine],
})
export class EngineModule { }
