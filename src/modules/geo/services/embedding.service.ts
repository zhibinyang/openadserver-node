import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { RedisService } from '../../../shared/redis/redis.service';

@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);
    private ai: GoogleGenAI;
    private model: string;
    private cacheTTL: number;

    constructor(
        private configService: ConfigService,
        private redisService: RedisService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
        this.model = this.configService.get<string>('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
        this.cacheTTL = this.configService.get<number>('EMBEDDING_CACHE_TTL', 86400); // 24 hours default
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log(`EmbeddingService initialized with model: ${this.model}, cacheTTL: ${this.cacheTTL}s`);
    }

    /**
     * Generate embedding for text with Redis caching.
     * Cache key is based on SHA256 hash of the text.
     */
    async embed(text: string): Promise<number[]> {
        // Generate cache key
        const cacheKey = this.getCacheKey(text);

        // Try to get from cache first
        try {
            const cached = await this.redisService.get(cacheKey);
            if (cached) {
                this.logger.debug(`Cache hit for embedding (key: ${cacheKey.substring(0, 20)}...)`);
                return JSON.parse(cached);
            }
        } catch (error) {
            this.logger.warn(`Failed to read embedding cache: ${error}`);
        }

        // Generate new embedding
        const result = await this.ai.models.embedContent({
            model: this.model,
            contents: text,
        });

        const vector = result.embeddings?.[0]?.values;
        if (!vector || vector.length === 0) {
            throw new Error('Embedding API returned empty vector');
        }

        // Cache the result
        try {
            await this.redisService.set(cacheKey, JSON.stringify(vector), this.cacheTTL);
            this.logger.debug(`Cached embedding (key: ${cacheKey.substring(0, 20)}..., dim=${vector.length})`);
        } catch (error) {
            this.logger.warn(`Failed to cache embedding: ${error}`);
        }

        this.logger.debug(`Generated embedding: dim=${vector.length}`);
        return vector;
    }

    /**
     * Generate cache key from text using SHA256 hash.
     */
    private getCacheKey(text: string): string {
        const hash = createHash('sha256').update(text).digest('hex');
        return `embedding:${this.model}:${hash}`;
    }
}
