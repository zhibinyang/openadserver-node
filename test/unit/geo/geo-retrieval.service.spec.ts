/**
 * GeoRetrievalService Unit Tests
 * Tests for GEO retrieval pipeline
 */

import { GeoRetrievalService } from '../../../src/modules/geo/pipeline/geo-retrieval.service';
import { EmbeddingService } from '../../../src/modules/geo/services/embedding.service';
import { MilvusService, MilvusSearchResult } from '../../../src/modules/geo/services/milvus.service';
import { GeoScoringService } from '../../../src/modules/geo/services/geo-scoring.service';
import { CacheService } from '../../../src/modules/engine/services/cache.service';
import { UserContext, BidType, CreativeType } from '../../../src/shared/types';
import * as schema from '../../../src/database/schema';

// Mock dependencies
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn(),
};

jest.mock('../../../src/database/database.module', () => ({
  DRIZZLE: 'DRIZZLE_TOKEN',
}));

describe('GeoRetrievalService', () => {
  let service: GeoRetrievalService;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockMilvusService: jest.Mocked<MilvusService>;
  let mockGeoScoringService: jest.Mocked<GeoScoringService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
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
        id: 1,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: null,
        budget_daily: '100.00',
        budget_total: '1000.00',
        status: 1,
      }),
    } as any;

    // Reset mock db
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReset();

    service = new GeoRetrievalService(
      mockDb as any,
      mockEmbeddingService,
      mockMilvusService,
      mockGeoScoringService,
      mockCacheService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const baseContext: UserContext = {
      user_id: 'test-user',
      ip: '127.0.0.1',
      os: 'Linux',
      device: 'Desktop',
      browser: 'Chrome',
      country: 'US',
      city: 'New York',
      app_id: 'test-app',
      query: 'test query',
      num_ads: 3,
    };

    it('should return empty array when query is missing', async () => {
      const context = { ...baseContext, query: undefined };
      const result = await service.execute(context);
      expect(result).toEqual([]);
    });

    it('should return empty array when query is empty string', async () => {
      const context = { ...baseContext, query: '' };
      const result = await service.execute(context);
      expect(result).toEqual([]);
    });

    it('should return empty array when Milvus returns no results', async () => {
      mockMilvusService.search.mockResolvedValueOnce([]);

      const result = await service.execute(baseContext);

      expect(result).toEqual([]);
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('test query');
    });

    it('should return empty array when no knowledge rows found', async () => {
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where.mockResolvedValueOnce([]); // No knowledge rows

      const result = await service.execute(baseContext);

      expect(result).toEqual([]);
    });

    it('should return empty array when campaign not in cache', async () => {
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where.mockResolvedValueOnce([
        { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'http://example.com' },
      ]);
      mockCacheService.getCampaign.mockReturnValueOnce(null);

      const result = await service.execute(baseContext);

      expect(result).toEqual([]);
    });

    it('should filter out campaigns with future start_time', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where.mockResolvedValueOnce([
        { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'http://example.com' },
      ]);
      mockCacheService.getCampaign.mockReturnValueOnce({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: futureDate,
        end_time: null,
        status: 1,
      });

      const result = await service.execute(baseContext);

      expect(result).toEqual([]);
    });

    it('should filter out campaigns with past end_time', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
      ]);
      mockDb.where.mockResolvedValueOnce([
        { id: 1, title: 'Test', content: 'Content', status: 1, source_url: 'http://example.com' },
      ]);
      mockCacheService.getCampaign.mockReturnValueOnce({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: pastDate,
        status: 1,
      });

      const result = await service.execute(baseContext);

      expect(result).toEqual([]);
    });

    it('should return candidates with correct structure', async () => {
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
        { knowledge_id: 2, creative_id: 101, campaign_id: 10, score: 0.8 },
        { knowledge_id: 3, creative_id: 102, campaign_id: 10, score: 0.7 },
      ]);
      mockCacheService.getCampaign.mockReturnValue({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: null,
        status: 1,
      });

      // First call: knowledge rows, Second call: advertiser brand_weight
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Title 1', content: 'Content 1', status: 1, source_url: 'http://example.com/1' },
          { id: 2, title: 'Title 2', content: 'Content 2', status: 1, source_url: 'http://example.com/2' },
          { id: 3, title: 'Title 3', content: 'Content 3', status: 1, source_url: 'http://example.com/3' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.5' }]);

      const result = await service.execute(baseContext);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('campaign_id');
      expect(result[0]).toHaveProperty('creative_id');
      expect(result[0]).toHaveProperty('advertiser_id');
      expect(result[0]).toHaveProperty('bid');
      expect(result[0]).toHaveProperty('bid_type', BidType.GEO);
      expect(result[0]).toHaveProperty('creative_type', CreativeType.GEO_SNIPPET);
      expect(result[0]).toHaveProperty('score');
    });

    it('should call embedding service with query', async () => {
      mockMilvusService.search.mockResolvedValueOnce([]);

      await service.execute(baseContext);

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('test query');
    });

    it('should call Milvus search with embedding vector', async () => {
      const testVector = new Array(3072).fill(0.5);
      mockEmbeddingService.embed.mockResolvedValueOnce(testVector);
      mockMilvusService.search.mockResolvedValueOnce([]);

      await service.execute(baseContext);

      expect(mockMilvusService.search).toHaveBeenCalledWith(testVector, 50);
    });

    it('should call geoScoringService for top 3 candidates', async () => {
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.9 },
        { knowledge_id: 2, creative_id: 101, campaign_id: 10, score: 0.8 },
        { knowledge_id: 3, creative_id: 102, campaign_id: 10, score: 0.7 },
        { knowledge_id: 4, creative_id: 103, campaign_id: 10, score: 0.6 },
      ]);
      mockCacheService.getCampaign.mockReturnValue({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: null,
        status: 1,
      });

      // First call: knowledge rows query, Second call: advertiser brand_weight
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Title 1', content: 'Content 1', status: 1, source_url: 'http://example.com/1' },
          { id: 2, title: 'Title 2', content: 'Content 2', status: 1, source_url: 'http://example.com/2' },
          { id: 3, title: 'Title 3', content: 'Content 3', status: 1, source_url: 'http://example.com/3' },
          { id: 4, title: 'Title 4', content: 'Content 4', status: 1, source_url: 'http://example.com/4' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.0' }]);

      await service.execute(baseContext);

      // Should only score top 3
      expect(mockGeoScoringService.scoreRelevance).toHaveBeenCalledTimes(3);
    });

    it('should filter results by min_score', async () => {
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.3 }, // Low geo_score
      ]);
      mockCacheService.getCampaign.mockReturnValue({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: null,
        status: 1,
      });
      mockGeoScoringService.scoreRelevance.mockResolvedValueOnce(0.1); // Low relevance

      // First call: knowledge rows, Second call: advertiser brand_weight
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Title 1', content: 'Content 1', status: 1, source_url: 'http://example.com/1' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.0' }]);

      const context = { ...baseContext, min_score: 0.6 };
      const result = await service.execute(context);

      // Score = (0.3 * 0.4 + 0.1 * 0.3 + 1.0 * 0.3) * 1.0 = 0.45, below min_score 0.6
      expect(result).toEqual([]);
    });

    it('should use default min_score of 0.6', async () => {
      mockMilvusService.search.mockResolvedValueOnce([
        { knowledge_id: 1, creative_id: 100, campaign_id: 10, score: 0.3 }, // Low geo_score
      ]);
      mockCacheService.getCampaign.mockReturnValue({
        id: 10,
        advertiser_id: 100,
        bid_amount: '5.00',
        start_time: null,
        end_time: null,
        status: 1,
      });
      mockGeoScoringService.scoreRelevance.mockResolvedValueOnce(0.1); // Low relevance

      // First call: knowledge rows, Second call: advertiser brand_weight
      mockDb.where
        .mockResolvedValueOnce([
          { id: 1, title: 'Title 1', content: 'Content 1', status: 1, source_url: 'http://example.com/1' },
        ])
        .mockResolvedValueOnce([{ brand_weight: '1.0' }]);

      const result = await service.execute(baseContext);

      // Score = (0.3 * 0.4 + 0.1 * 0.3 + 1.0 * 0.3) * 1.0 = 0.45, below default min_score 0.6
      expect(result).toEqual([]);
    });
  });
});
