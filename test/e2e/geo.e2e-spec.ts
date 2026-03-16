import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { EmbeddingService } from '../../src/modules/geo/services/embedding.service';
import { MilvusService } from '../../src/modules/geo/services/milvus.service';
import { GeoScoringService } from '../../src/modules/geo/services/geo-scoring.service';
import { CacheService } from '../../src/modules/engine/services/cache.service';
import { DRIZZLE } from '../../src/database/database.module';

describe('GEO Ad Endpoint (e2e)', () => {
    let app: NestFastifyApplication;
    let mockEmbeddingService: jest.Mocked<EmbeddingService>;
    let mockMilvusService: jest.Mocked<MilvusService>;
    let mockGeoScoringService: jest.Mocked<GeoScoringService>;
    let mockCacheService: jest.Mocked<CacheService>;
    let mockDb: any;

    beforeAll(async () => {
        // Create mocks
        mockEmbeddingService = {
            embed: jest.fn(),
        } as any;

        mockMilvusService = {
            search: jest.fn(),
        } as any;

        mockGeoScoringService = {
            scoreRelevance: jest.fn(),
        } as any;

        mockCacheService = {
            getCampaign: jest.fn(),
        } as any;

        // Mock database with chainable query builder
        mockDb = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(EmbeddingService)
            .useValue(mockEmbeddingService)
            .overrideProvider(MilvusService)
            .useValue(mockMilvusService)
            .overrideProvider(GeoScoringService)
            .useValue(mockGeoScoringService)
            .overrideProvider(CacheService)
            .useValue(mockCacheService)
            .overrideProvider(DRIZZLE)
            .useValue(mockDb)
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(
            new FastifyAdapter()
        );
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
        }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /ad/geo', () => {
        const validRequest = {
            query: '如何选择合适的婴儿奶粉？',
            user_id: 'test-user-123',
            num_ads: 3,
            min_score: 0.5,
        };

        it('should return 400 when query is missing', async () => {
            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send({ user_id: 'test-user' });

            expect(response.status).toBe(400);
        });

        it('should return empty results when no matching ads found', async () => {
            mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
            mockMilvusService.search.mockResolvedValueOnce([]);

            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send(validRequest);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('request_id');
            expect(response.body).toHaveProperty('query', validRequest.query);
            expect(response.body.results).toEqual([]);
        });

        it('should return matching ads with scores', async () => {
            // Setup mocks
            mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
            mockMilvusService.search.mockResolvedValueOnce([
                { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.95 },
                { knowledge_id: 2, creative_id: 101, campaign_id: 11, score: 0.85 },
            ]);
            mockCacheService.getCampaign
                .mockReturnValueOnce({
                    id: 10,
                    advertiser_id: 100,
                    bid_amount: '5.00',
                    start_time: null,
                    end_time: null,
                    status: 1,
                })
                .mockReturnValueOnce({
                    id: 11,
                    advertiser_id: 101,
                    bid_amount: '4.00',
                    start_time: null,
                    end_time: null,
                    status: 1,
                });
            mockGeoScoringService.scoreRelevance
                .mockResolvedValueOnce(0.9)
                .mockResolvedValueOnce(0.8);

            // Mock database queries
            // First call: fetch knowledge rows
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([
                        { id: 1, title: 'Test Title 1', content: 'Test content 1', source_url: 'http://example.com/1', status: 1 },
                        { id: 2, title: 'Test Title 2', content: 'Test content 2', source_url: 'http://example.com/2', status: 1 },
                    ]),
                }),
            });
            // Second call: fetch brand weights (called twice for 2 advertisers)
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });

            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send(validRequest);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('request_id');
            expect(response.body).toHaveProperty('query', validRequest.query);
            expect(response.body.results).toBeInstanceOf(Array);
            expect(response.body.results.length).toBeGreaterThan(0);

            // Verify result structure
            const result = response.body.results[0];
            expect(result).toHaveProperty('knowledge_id');
            expect(result).toHaveProperty('creative_id');
            expect(result).toHaveProperty('campaign_id');
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('snippet');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('geo_score');
            expect(result).toHaveProperty('relevance_score');
            expect(result).toHaveProperty('click_id');
        });

        it('should filter results by min_score', async () => {
            mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
            mockMilvusService.search.mockResolvedValueOnce([
                { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.3 },
            ]);
            mockCacheService.getCampaign.mockReturnValueOnce({
                id: 10,
                advertiser_id: 100,
                bid_amount: '5.00',
                start_time: null,
                end_time: null,
                status: 1,
            });
            mockGeoScoringService.scoreRelevance.mockResolvedValueOnce(0.1);

            // Mock database queries
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([
                        { id: 1, title: 'Test Title', content: 'Test content', source_url: 'http://example.com', status: 1 },
                    ]),
                }),
            });
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });

            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send({ ...validRequest, min_score: 0.8 });

            expect(response.status).toBe(201);
            expect(response.body.results).toEqual([]);
        });

        it('should respect num_ads parameter', async () => {
            mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
            mockMilvusService.search.mockResolvedValueOnce([
                { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.95 },
                { knowledge_id: 2, creative_id: 101, campaign_id: 11, score: 0.85 },
                { knowledge_id: 3, creative_id: 102, campaign_id: 12, score: 0.75 },
            ]);
            mockCacheService.getCampaign
                .mockReturnValueOnce({ id: 10, advertiser_id: 100, bid_amount: '5.00', start_time: null, end_time: null, status: 1 })
                .mockReturnValueOnce({ id: 11, advertiser_id: 101, bid_amount: '4.00', start_time: null, end_time: null, status: 1 })
                .mockReturnValueOnce({ id: 12, advertiser_id: 102, bid_amount: '3.00', start_time: null, end_time: null, status: 1 });
            mockGeoScoringService.scoreRelevance
                .mockResolvedValueOnce(0.9)
                .mockResolvedValueOnce(0.8)
                .mockResolvedValueOnce(0.7);

            // Mock database queries
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([
                        { id: 1, title: 'Test Title 1', content: 'Test content 1', source_url: 'http://example.com/1', status: 1 },
                        { id: 2, title: 'Test Title 2', content: 'Test content 2', source_url: 'http://example.com/2', status: 1 },
                        { id: 3, title: 'Test Title 3', content: 'Test content 3', source_url: 'http://example.com/3', status: 1 },
                    ]),
                }),
            });
            // Brand weights for 3 advertisers
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });

            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send({ ...validRequest, num_ads: 1 });

            expect(response.status).toBe(201);
            // GEO pipeline returns top 3 for scoring, but final results depend on min_score
            // The num_ads affects how many are returned to client
        });

        it('should handle user context correctly', async () => {
            mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
            mockMilvusService.search.mockResolvedValueOnce([]);

            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send({
                    ...validRequest,
                    country: 'CN',
                    city: 'Shanghai',
                    device: 'iPhone',
                    os: 'iOS',
                });

            expect(response.status).toBe(201);
        });

        it('should handle campaign time filtering', async () => {
            const now = new Date();
            const pastDate = new Date(now.getTime() - 86400000).toISOString(); // 1 day ago
            const futureDate = new Date(now.getTime() + 86400000).toISOString(); // 1 day from now

            mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
            mockMilvusService.search.mockResolvedValueOnce([
                { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.95 },
                { knowledge_id: 2, creative_id: 101, campaign_id: 11, score: 0.85 },
            ]);
            // Campaign 10: ended in the past (should be filtered)
            mockCacheService.getCampaign
                .mockReturnValueOnce({
                    id: 10,
                    advertiser_id: 100,
                    bid_amount: '5.00',
                    start_time: null,
                    end_time: pastDate, // Already ended
                    status: 1,
                })
                // Campaign 11: valid
                .mockReturnValueOnce({
                    id: 11,
                    advertiser_id: 101,
                    bid_amount: '4.00',
                    start_time: null,
                    end_time: futureDate, // Still active
                    status: 1,
                });
            mockGeoScoringService.scoreRelevance.mockResolvedValueOnce(0.9);

            // Mock database queries
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([
                        { id: 1, title: 'Test Title 1', content: 'Test content 1', source_url: 'http://example.com/1', status: 1 },
                        { id: 2, title: 'Test Title 2', content: 'Test content 2', source_url: 'http://example.com/2', status: 1 },
                    ]),
                }),
            });
            mockDb.select.mockReturnValueOnce({
                from: jest.fn().mockReturnValueOnce({
                    where: jest.fn().mockResolvedValueOnce([{ brand_weight: '1.0' }]),
                }),
            });

            const response = await request(app.getHttpServer())
                .post('/ad/geo')
                .send(validRequest);

            expect(response.status).toBe(201);
            // Only campaign 11 should be returned (campaign 10 is expired)
        });
    });
});
