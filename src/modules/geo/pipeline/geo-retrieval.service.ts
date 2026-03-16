import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { AdCandidate, UserContext, BidType, CreativeType } from '../../../shared/types';
import { EmbeddingService } from '../services/embedding.service';
import { MilvusService, MilvusSearchResult } from '../services/milvus.service';
import { GeoScoringService } from '../services/geo-scoring.service';
import { CacheService } from '../../engine/services/cache.service';

@Injectable()
export class GeoRetrievalService {
    private readonly logger = new Logger(GeoRetrievalService.name);

    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
        private embeddingService: EmbeddingService,
        private milvusService: MilvusService,
        private geoScoringService: GeoScoringService,
        @Inject(forwardRef(() => CacheService))
        private cacheService: CacheService,
    ) {}

    /**
     * Full GEO retrieval pipeline:
     * 1. Generate query embedding
     * 2. Milvus Top-K search
     * 3. Complement with campaign/creative info from CacheService
     * 4. Filter by budget/status
     * 5. AI scoring (Top 3)
     * 6. Final ranking with brand_weight
     */
    async execute(context: UserContext): Promise<AdCandidate[]> {
        const query = context.query;
        if (!query) {
            this.logger.warn('GEO request without query');
            return [];
        }

        const start = Date.now();

        // 1. Generate query embedding
        const queryVector = await this.embeddingService.embed(query);
        this.logger.debug(`Query embedding generated in ${Date.now() - start}ms`);

        // 2. Milvus Top-K search
        const milvusResults = await this.milvusService.search(queryVector, 50);
        this.logger.debug(`Milvus returned ${milvusResults.length} results`);

        if (milvusResults.length === 0) return [];

        // 3. Fetch knowledge snippets from Postgres (efficient IN query)
        const knowledgeIds = milvusResults.map(r => r.knowledge_id);
        const knowledgeRows = await this.db
            .select()
            .from(schema.geo_knowledge)
            .where(
                and(
                    inArray(schema.geo_knowledge.id, knowledgeIds),
                    eq(schema.geo_knowledge.status, 1), // ACTIVE only
                ),
            );

        // Build a map for quick lookup
        const knowledgeMap = new Map<number, typeof knowledgeRows[0]>();
        for (const row of knowledgeRows) {
            knowledgeMap.set(row.id, row);
        }

        // 4. Build candidates and filter
        const candidates: AdCandidate[] = [];
        for (const result of milvusResults) {
            const knowledge = knowledgeMap.get(result.knowledge_id);
            if (!knowledge) continue;

            // Get campaign from cache
            const campaign = this.cacheService.getCampaign(result.campaign_id);
            if (!campaign) continue;

            // Check if campaign is still valid (time-based)
            const now = new Date();
            if (campaign.start_time && new Date(campaign.start_time) > now) continue;
            if (campaign.end_time && new Date(campaign.end_time) < now) continue;

            candidates.push({
                campaign_id: result.campaign_id,
                creative_id: result.creative_id,
                advertiser_id: campaign.advertiser_id,
                bid: parseFloat(campaign.bid_amount || '0'),
                bid_type: BidType.GEO,
                creative_type: CreativeType.GEO_SNIPPET,
                title: knowledge.title,
                description: knowledge.content,
                landing_url: knowledge.source_url || '',
                geo_score: result.score,
                snippet: knowledge.content,
                knowledge_id: knowledge.id,
                metadata: {},
            });
        }

        this.logger.debug(`${candidates.length} candidates after filtering`);

        if (candidates.length === 0) return [];

        // 5. AI scoring for Top 3 (parallel processing)
        // Sort by geo_score first to pick the best
        candidates.sort((a, b) => (b.geo_score || 0) - (a.geo_score || 0));

        const top3 = candidates.slice(0, 3);

        // Score all candidates in parallel for better performance
        const relevanceScores = await Promise.all(
            top3.map(candidate =>
                this.geoScoringService.scoreRelevance(query, candidate.snippet || '')
            )
        );

        // Assign scores back to candidates
        top3.forEach((candidate, index) => {
            candidate.relevance_score = relevanceScores[index];
        });

        // 6. Fetch brand_weight for advertisers
        const advertiserIds = [...new Set(top3.map(c => c.advertiser_id))];
        const brandWeights = new Map<number, number>();
        for (const advId of advertiserIds) {
            const [adv] = await this.db
                .select({ brand_weight: schema.advertisers.brand_weight })
                .from(schema.advertisers)
                .where(eq(schema.advertisers.id, advId));
            brandWeights.set(advId, parseFloat(adv?.brand_weight || '1.0'));
        }

        // 7. Calculate final score with brand_weight
        const maxEcpm = Math.max(...top3.map(c => c.bid), 0.01);

        for (const candidate of top3) {
            const geoScore = candidate.geo_score || 0;
            const relevanceScore = candidate.relevance_score || 0;
            const ecpmNorm = candidate.bid / maxEcpm;
            const brandWeight = brandWeights.get(candidate.advertiser_id) || 1.0;

            candidate.score = (geoScore * 0.4 + relevanceScore * 0.3 + ecpmNorm * 0.3) * brandWeight;
            candidate.ecpm = candidate.bid; // GEO uses flat bid as eCPM

            this.logger.debug(
                `Candidate cre=${candidate.creative_id} | geo=${geoScore.toFixed(3)} rel=${relevanceScore.toFixed(3)} ecpm_n=${ecpmNorm.toFixed(3)} bw=${brandWeight} => score=${candidate.score.toFixed(4)}`
            );
        }

        // 8. Filter by min_score and sort
        const minScore = context.min_score ?? 0.6;
        const filtered = top3.filter(c => (c.score || 0) >= minScore);
        
        // Sort by final score descending
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

        const duration = Date.now() - start;
        this.logger.log(`GEO pipeline finished in ${duration}ms. Returned ${filtered.length} candidates (min_score=${minScore}).`);

        return filtered;
    }
}
