/**
 * Ad Engine Integration Tests
 * Tests the complete ad recommendation pipeline with mocked dependencies
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AdEngine } from '../../../src/modules/engine/ad-engine.service';
import { RetrievalService } from '../../../src/modules/engine/pipeline/1-retrieval.service';
import { FilterService } from '../../../src/modules/engine/pipeline/2-filter.service';
import { PredictionService } from '../../../src/modules/engine/pipeline/3-prediction.service';
import { RankingService } from '../../../src/modules/engine/pipeline/4-ranking.service';
import { RerankService } from '../../../src/modules/engine/pipeline/5-rerank.service';
import { UserProfileService } from '../../../src/modules/engine/services/user-profile.service';
import { TargetingMatcher } from '../../../src/modules/engine/services/targeting.matcher';
import { RedisService } from '../../../src/shared/redis/redis.service';
import { CacheService } from '../../../src/modules/engine/services/cache.service';
import { UserContext, BidType, CreativeType } from '../../../src/shared/types';
import { MockRedis } from '../../mocks/mock-redis';

describe('Ad Engine Integration', () => {
  let adEngine: AdEngine;
  let mockRedis: MockRedis;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockRedisService: jest.Mocked<RedisService>;

  // Test user context
  const testContext: UserContext = {
    user_id: 'test-user-001',
    ip: '8.8.8.8',
    country: 'US',
    city: 'New York',
    device: 'Desktop',
    browser: 'chrome',
    os: 'windows',
    age: 28,
    gender: 'male',
    interests: ['tech', 'sports'],
  };

  beforeEach(() => {
    // Create mock Redis
    mockRedis = new MockRedis();

    // Create mock services
    mockRedisService = {
      client: mockRedis as any,
    } as jest.Mocked<RedisService>;

    mockCacheService = {
      getCampaign: jest.fn().mockReturnValue({
        id: 1,
        advertiser_id: 1,
        name: 'Test Campaign',
        budget_daily: '100.00',
        budget_total: '1000.00',
        freq_cap_daily: 10,
        pacing_type: 1,
        bid_type: BidType.CPM,
        bid_amount: '2.00',
        status: 1,
        is_active: true,
      }),
      getCampaigns: jest.fn().mockReturnValue([
        {
          id: 1,
          advertiser_id: 1,
          name: 'Test Campaign 1',
          budget_daily: '100.00',
          budget_total: '1000.00',
          freq_cap_daily: 10,
          pacing_type: 1,
          bid_type: BidType.CPM,
          bid_amount: '2.00',
          status: 1,
          is_active: true,
        },
      ]),
      getCreativesByCampaign: jest.fn().mockReturnValue([
        {
          id: 1,
          campaign_id: 1,
          title: 'Test Creative',
          landing_url: 'https://example.com',
          creative_type: CreativeType.BANNER,
          width: 300,
          height: 250,
          status: 1,
        },
      ]),
      getRulesByCampaign: jest.fn().mockReturnValue([]),
      refreshCache: jest.fn(),
    } as any;
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('Pipeline Components', () => {
    it('should create RankingService and rank candidates', () => {
      const rankingService = new RankingService();

      const candidates = [
        { campaign_id: 1, creative_id: 1, bid: 2.0, bid_type: BidType.CPM, pctr: 0.02, pcvr: 0.1 },
        { campaign_id: 2, creative_id: 2, bid: 3.0, bid_type: BidType.CPM, pctr: 0.02, pcvr: 0.1 },
      ];

      const result = rankingService.execute(candidates, testContext);

      expect(result).toHaveLength(2);
      expect(result[0].campaign_id).toBe(2); // Higher bid first
      expect(result[0].ecpm).toBe(3.0);
    });

    it('should create FilterService and filter candidates', async () => {
      const filterService = new FilterService(mockRedisService, mockCacheService);

      const candidates = [
        {
          campaign_id: 1,
          creative_id: 1,
          bid: 2.0,
          bid_type: BidType.CPM,
          creative_type: CreativeType.BANNER,
          width: 300,
          height: 250,
        },
      ];

      const result = await filterService.execute(candidates, testContext);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should create TargetingMatcher and match rules', async () => {
      const targetingMatcher = new TargetingMatcher();

      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: 'geo',
          rule_value: { countries: ['US'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const result = await targetingMatcher.match(rules, testContext);
      expect(result).toBe(true);
    });
  });

  describe('eCPM Calculation Integration', () => {
    it('should calculate correct eCPM for different bid types', () => {
      const rankingService = new RankingService();

      const candidates = [
        { campaign_id: 1, creative_id: 1, bid: 5.0, bid_type: BidType.CPM, pctr: 0.02, pcvr: 0.1 },
        { campaign_id: 2, creative_id: 2, bid: 0.5, bid_type: BidType.CPC, pctr: 0.02, pcvr: 0.1 },
        { campaign_id: 3, creative_id: 3, bid: 10.0, bid_type: BidType.CPA, pctr: 0.02, pcvr: 0.1 },
      ];

      const result = rankingService.execute(candidates, testContext);

      // CPM: eCPM = 5.0
      // CPC: eCPM = 0.5 * 0.02 * 1000 = 10.0
      // CPA: eCPM = 10.0 * 0.02 * 0.1 * 1000 = 20.0
      expect(result[0].campaign_id).toBe(3); // CPA highest
      expect(result[1].campaign_id).toBe(2); // CPC middle
      expect(result[2].campaign_id).toBe(1); // CPM lowest
    });
  });

  describe('Filter Integration', () => {
    it('should filter by slot type', async () => {
      const filterService = new FilterService(mockRedisService, mockCacheService);

      const candidates = [
        { campaign_id: 1, creative_id: 1, bid: 2.0, bid_type: BidType.CPM, creative_type: CreativeType.BANNER, width: 300, height: 250 },
        { campaign_id: 2, creative_id: 2, bid: 2.0, bid_type: BidType.CPM, creative_type: CreativeType.VIDEO, width: 640, height: 360 },
      ];

      const contextWithSlot = { ...testContext, slot_type: CreativeType.BANNER };
      const result = await filterService.execute(candidates, contextWithSlot);

      expect(result).toHaveLength(1);
      expect(result[0].creative_type).toBe(CreativeType.BANNER);
    });
  });
});