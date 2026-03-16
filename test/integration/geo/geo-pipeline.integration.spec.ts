/**
 * GEO Pipeline Integration Tests
 * Tests the complete GEO retrieval pipeline with mocked dependencies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GeoRetrievalService } from '../../../src/modules/geo/pipeline/geo-retrieval.service';
import { EmbeddingService } from '../../../src/modules/geo/services/embedding.service';
import { MilvusService, MilvusSearchResult } from '../../../src/modules/geo/services/milvus.service';
import { GeoScoringService } from '../../../src/modules/geo/services/geo-scoring.service';
import { CacheService } from '../../../src/modules/engine/services/cache.service';
import { UserContext, BidType, CreativeType } from '../../../src/shared/types';
import { MockRedis } from '../../mocks/mock-redis';

describe('GEO Pipeline Integration', () => {
  let geoRetrievalService: GeoRetrievalService;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockMilvusService: jest.Mocked<MilvusService>;
  let mockGeoScoringService: jest.Mocked<GeoScoringService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockDb: any;

  const testContext: UserContext = {
    user_id: 'test-user-001',
    ip: '8.8.8.8',
    country: 'US',
    city: 'New York',
    device: 'Desktop',
    browser: 'chrome',
    os: 'windows',
    query: 'best running shoes for marathon',
    num_ads: 3,
  };

  beforeEach(() => {
    // Create mock services
    mockEmbeddingService = {
      embed: jest.fn().mockResolvedValue(new Array(3072).fill(0.1)),
    } as any;

    mockMilvusService = {
      search: jest.fn().mockResolvedValue([]),
    } as any;

    mockGeoScoringService = {
      scoreRelevance: jest.fn().mockResolvedValue(0.8),
    } as any;

    mockCacheService = {
      getCampaign: jest.fn().mockReturnValue({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: null,
        budget_daily: '100.00',
        budget_total: '1000.00',
        status: 1,
      }),
    } as any;

    // Mock database
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };

    geoRetrievalService = new GeoRetrievalService(
      mockDb,
      mockEmbeddingService,
      mockMilvusService,
      mockGeoScoringService,
      mockCacheService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End GEO Pipeline', () => {
    it('should complete full pipeline with valid results', async () => {
      // Setup mocks for full pipeline
      const mockVector = new Array(3072).fill(0.1);
      mockEmbeddingService.embed.mockResolvedValueOnce(mockVector);

      const mockMilvusResults: MilvusSearchResult[] = [
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.95 },
        { knowledge_id: 2, creative_id: 101, campaign_id: 10, score: 0.85 },
        { knowledge_id: 3, creative_id: 102, campaign_id: 10, score: 0.75 },
      ];
      mockMilvusService.search.mockResolvedValueOnce(mockMilvusResults);

      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Best Marathon Shoes', content: 'Top running shoes for marathons...', status: 1, source_url: 'https://example.com/1' },
          { id: 2, title: 'Running Gear Guide', content: 'Essential gear for marathon runners...', status: 1, source_url: 'https://example.com/2' },
          { id: 3, title: 'Marathon Training Tips', content: 'How to train for your first marathon...', status: 1, source_url: 'https://example.com/3' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.5' }]);

      mockGeoScoringService.scoreRelevance
        .mockResolvedValueOnce(0.9)
        .mockResolvedValueOnce(0.8)
        .mockResolvedValueOnce(0.7);

      const result = await geoRetrievalService.execute(testContext);

      // Verify pipeline steps
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('best running shoes for marathon');
      expect(mockMilvusService.search).toHaveBeenCalledWith(mockVector, 50);
      expect(mockGeoScoringService.scoreRelevance).toHaveBeenCalledTimes(3);

      // Verify results
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('knowledge_id');
      expect(result[0]).toHaveProperty('campaign_id');
      expect(result[0]).toHaveProperty('creative_id');
      expect(result[0]).toHaveProperty('score');
      expect(result[0]).toHaveProperty('geo_score');
      expect(result[0]).toHaveProperty('relevance_score');
    });

    it('should handle empty Milvus results gracefully', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([]);

      const result = await geoRetrievalService.execute(testContext);

      expect(result).toEqual([]);
      expect(mockGeoScoringService.scoreRelevance).not.toHaveBeenCalled();
    });

    it('should handle missing knowledge rows', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 999, creative_id: 100, campaign_id: 10, score: 0.95 },
      ]);
      mockDb.where.mockResolvedValueOnce([]); // No matching knowledge rows

      const result = await geoRetrievalService.execute(testContext);

      expect(result).toEqual([]);
    });

    it('should handle missing campaigns', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 999, score: 0.95 },
      ]);
      mockDb.where.mockResolvedValueOnce([
        { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
      ]);
      mockCacheService.getCampaign.mockReturnValueOnce(null);

      const result = await geoRetrievalService.execute(testContext);

      expect(result).toEqual([]);
    });
  });

  describe('Scoring Integration', () => {
    it('should calculate final score with correct weights', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '2.0' }]);
      mockGeoScoringService.scoreRelevance.mockResolvedValueOnce(0.8);

      const result = await geoRetrievalService.execute(testContext);

      expect(result.length).toBeGreaterThan(0);
      // Final score should be: (geo_score * 0.4 + relevance * 0.3 + ecpm_norm * 0.3) * brand_weight
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].geo_score).toBe(0.9);
      expect(result[0].relevance_score).toBe(0.8);
    });

    it('should apply brand weight correctly', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValue([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '2.0' }]);
      mockGeoScoringService.scoreRelevance.mockResolvedValue(0.8);

      const resultWithBrandWeight = await geoRetrievalService.execute(testContext);

      // Reset for second test
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.0' }]);

      const resultWithoutBrandWeight = await geoRetrievalService.execute(testContext);

      // Higher brand weight should result in higher score
      expect(resultWithBrandWeight[0].score).toBeGreaterThan(resultWithoutBrandWeight[0].score);
    });
  });

  describe('Filtering Integration', () => {
    it('should filter by min_score threshold', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.3 },
      ]);
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.0' }]);
      mockGeoScoringService.scoreRelevance.mockResolvedValueOnce(0.2); // Low relevance

      const contextWithHighMinScore = { ...testContext, min_score: 0.8 };
      const result = await geoRetrievalService.execute(contextWithHighMinScore);

      expect(result).toEqual([]);
    });

    it('should filter expired campaigns', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where.mockResolvedValueOnce([
        { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
      ]);

      // Campaign ended yesterday
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockCacheService.getCampaign.mockReturnValueOnce({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: pastDate,
        status: 1,
      });

      const result = await geoRetrievalService.execute(testContext);

      expect(result).toEqual([]);
    });

    it('should filter inactive knowledge rows', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      // Knowledge row with status != 1 should not be returned by the query
      mockDb.where.mockResolvedValueOnce([]);

      const result = await geoRetrievalService.execute(testContext);

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding service errors', async () => {
      mockEmbeddingService.embed.mockRejectedValueOnce(new Error('Embedding API error'));

      await expect(geoRetrievalService.execute(testContext)).rejects.toThrow('Embedding API error');
    });

    it('should handle Milvus service errors', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockRejectedValueOnce(new Error('Milvus connection error'));

      await expect(geoRetrievalService.execute(testContext)).rejects.toThrow('Milvus connection error');
    });

    it('should handle scoring errors gracefully', async () => {
      mockEmbeddingService.embed.mockResolvedValueOnce(new Array(3072).fill(0.1));
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'https://example.com' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.0' }]);
      mockGeoScoringService.scoreRelevance.mockRejectedValueOnce(new Error('Scoring error'));

      await expect(geoRetrievalService.execute(testContext)).rejects.toThrow('Scoring error');
    });
  });
});
