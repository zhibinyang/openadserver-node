import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { EngineModule } from '../engine/engine.module';
import { MilvusService } from './services/milvus.service';
import { EmbeddingService } from './services/embedding.service';
import { GeoScoringService } from './services/geo-scoring.service';
import { GeoRetrievalService } from './pipeline/geo-retrieval.service';

@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        forwardRef(() => EngineModule), // For CacheService
    ],
    providers: [
        MilvusService,
        EmbeddingService,
        GeoScoringService,
        GeoRetrievalService,
    ],
    exports: [
        MilvusService,
        EmbeddingService,
        GeoScoringService,
        GeoRetrievalService,
    ],
})
export class GeoModule {}
