/**
 * FilterService Unit Tests
 * Tests for budget, pacing, and frequency cap filtering
 */

import { FilterService } from '../../../src/modules/engine/pipeline/2-filter.service';
import { RedisService } from '../../../src/shared/redis/redis.service';
import { CacheService } from '../../../src/modules/engine/services/cache.service';
import { AdCandidate, UserContext, CreativeType } from '../../../src/shared/types';
import { MockRedis } from '../../mocks/mock-redis';
import { createTestCampaign } from '../../fixtures';

describe('FilterService', () => {
  let service: FilterService;
  let mockRedis: MockRedis;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockCacheService: jest.Mocked<CacheService>;

  // Helper to create ad candidate
  function createCandidate(overrides: Partial<AdCandidate> = {}): AdCandidate {
    return {
      campaign_id: 1,
      creative_id: 1,
      bid: 1.0,
      bid_type: 1,
      creative_type: CreativeType.BANNER,
      width: 300,
      height: 250,
      ...overrides,
    };
  }

  // Helper to create user context
  function createContext(overrides: Partial<UserContext> = {}): UserContext {
    return {
      user_id: 'user-001',
      os: 'iOS',
      ip: '192.168.1.1',
      app_id: 'test-app',
      ...overrides,
    };
  }

  beforeEach(() => {
    // Create mock Redis
    mockRedis = new MockRedis();

    // Create mock RedisService
    mockRedisService = {
      client: mockRedis as any,
    } as jest.Mocked<RedisService>;

    // Create mock CacheService
    mockCacheService = {
      getCampaign: jest.fn().mockImplementation((id: number) => ({
        id,
        budget_daily: '100.00',
        budget_total: '1000.00',
        freq_cap_daily: 10,
        pacing_type: 1, // EVEN
      })),
    } as jest.Mocked<CacheService>;

    service = new FilterService(mockRedisService, mockCacheService);
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('execute', () => {
    it('should return empty array when no candidates', async () => {
      const result = await service.execute([], createContext());
      expect(result).toEqual([]);
    });

    it('should pass through candidates when no filters apply', async () => {
      const candidates = [createCandidate()];
      const result = await service.execute(candidates, createContext());
      expect(result).toHaveLength(1);
    });
  });

  describe('Slot Type Filter', () => {
    it('should filter by slot_type (creative_type)', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, creative_type: CreativeType.BANNER }),
        createCandidate({ campaign_id: 2, creative_type: CreativeType.VIDEO }),
      ];
      const context = createContext({ slot_type: CreativeType.BANNER });

      const result = await service.execute(candidates, context);
      expect(result).toHaveLength(1);
      expect(result[0].campaign_id).toBe(1);
    });

    it('should return empty when no matching slot_type', async () => {
      const candidates = [createCandidate({ creative_type: CreativeType.BANNER })];
      const context = createContext({ slot_type: CreativeType.VIDEO });

      const result = await service.execute(candidates, context);
      expect(result).toHaveLength(0);
    });
  });

  describe('Dimension Filter', () => {
    it('should filter by width and height', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, width: 300, height: 250 }),
        createCandidate({ campaign_id: 2, width: 728, height: 90 }),
      ];
      const context = createContext({ slot_width: 300, slot_height: 250 });

      const result = await service.execute(candidates, context);
      expect(result).toHaveLength(1);
      expect(result[0].campaign_id).toBe(1);
    });

    it('should not filter when dimensions not specified', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, width: 300, height: 250 }),
        createCandidate({ campaign_id: 2, width: 728, height: 90 }),
      ];
      const context = createContext(); // No slot dimensions

      const result = await service.execute(candidates, context);
      expect(result).toHaveLength(2);
    });
  });

  describe('Budget Filter', () => {
    it('should drop candidate when daily budget exhausted', async () => {
      // Set up spent amount in Redis
      const today = new Date().toISOString().split('T')[0];
      await mockRedis.hset(`budget:1:${today}`, 'spent_today', '100');

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext());
      expect(result).toHaveLength(0);
    });

    it('should drop candidate when total budget exhausted', async () => {
      // Set up total spent in Redis
      await mockRedis.hset('budget:total:1', 'spent_total', '1000');

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext());
      expect(result).toHaveLength(0);
    });

    it('should pass candidate with budget remaining', async () => {
      // Set up partial spend with DAILY_ASAP pacing to avoid probabilistic throttling
      mockCacheService.getCampaign.mockImplementation((id: number) => ({
        id,
        budget_daily: '100.00',
        budget_total: '1000.00',
        freq_cap_daily: 10,
        pacing_type: 3, // DAILY_ASAP - no throttling until limit hit
      }));

      const today = new Date().toISOString().split('T')[0];
      await mockRedis.hset(`budget:1:${today}`, 'spent_today', '50');

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext());
      expect(result).toHaveLength(1);
    });

    it('should handle missing campaign gracefully', async () => {
      // Reset and make all calls return null
      mockCacheService.getCampaign.mockReset();
      mockCacheService.getCampaign.mockReturnValue(null as any);

      const candidates = [createCandidate({ campaign_id: 999 })];
      const result = await service.execute(candidates, createContext());
      expect(result).toHaveLength(0);
    });
  });

  describe('Frequency Cap Filter', () => {
    it('should drop candidate when frequency cap reached', async () => {
      // Set up frequency count in Redis
      await mockRedis.set('freq:user-001:1', '10');

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext({ user_id: 'user-001' }));
      expect(result).toHaveLength(0);
    });

    it('should pass candidate when under frequency cap', async () => {
      // Set up frequency count below limit
      await mockRedis.set('freq:user-001:1', '5');

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext({ user_id: 'user-001' }));
      expect(result).toHaveLength(1);
    });

    it('should not check frequency when no user_id', async () => {
      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext({ user_id: undefined }));
      expect(result).toHaveLength(1);
    });

    it('should pass when freq_cap_daily is 0', async () => {
      mockCacheService.getCampaign.mockReturnValueOnce({
        id: 1,
        budget_daily: '100.00',
        budget_total: '1000.00',
        freq_cap_daily: 0, // No cap
        pacing_type: 1,
      } as any);

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext({ user_id: 'user-001' }));
      expect(result).toHaveLength(1);
    });
  });

  describe('Pacing Type EVER_GREEN', () => {
    it('should ignore budget and frequency caps for EVER_GREEN pacing', async () => {
      mockCacheService.getCampaign.mockReturnValue({
        id: 1,
        budget_daily: '100.00',
        budget_total: '1000.00',
        freq_cap_daily: 10,
        pacing_type: 5, // EVER_GREEN
      } as any);

      // Set up exhausted budget and frequency
      const today = new Date().toISOString().split('T')[0];
      await mockRedis.hset(`budget:1:${today}`, 'spent_today', '200');
      await mockRedis.set('freq:user-001:1', '20');

      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, createContext({ user_id: 'user-001' }));
      expect(result).toHaveLength(1);
    });
  });

  describe('Multiple Candidates', () => {
    it('should filter multiple candidates correctly', async () => {
      mockCacheService.getCampaign
        .mockReturnValueOnce({
          id: 1,
          budget_daily: '100.00',
          budget_total: '1000.00',
          freq_cap_daily: 10,
          pacing_type: 1,
        } as any)
        .mockReturnValueOnce({
          id: 2,
          budget_daily: '100.00',
          budget_total: '1000.00',
          freq_cap_daily: 10,
          pacing_type: 1,
        } as any)
        .mockReturnValueOnce({
          id: 3,
          budget_daily: '100.00',
          budget_total: '1000.00',
          freq_cap_daily: 10,
          pacing_type: 1,
        } as any);

      // Campaign 1: exhausted daily budget
      const today = new Date().toISOString().split('T')[0];
      await mockRedis.hset(`budget:1:${today}`, 'spent_today', '100');

      // Campaign 2: frequency capped
      await mockRedis.set('freq:user-001:2', '10');

      // Campaign 3: should pass
      const candidates = [
        createCandidate({ campaign_id: 1 }),
        createCandidate({ campaign_id: 2 }),
        createCandidate({ campaign_id: 3 }),
      ];

      const result = await service.execute(candidates, createContext({ user_id: 'user-001' }));
      expect(result).toHaveLength(1);
      expect(result[0].campaign_id).toBe(3);
    });
  });
});
