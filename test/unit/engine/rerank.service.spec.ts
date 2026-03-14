/**
 * RerankService Unit Tests
 * Tests for the reranking and diversity logic
 */

import { RerankService } from '../../../src/modules/engine/pipeline/5-rerank.service';
import { AdCandidate } from '../../../src/shared/types';

describe('RerankService', () => {
  let service: RerankService;

  beforeEach(() => {
    service = new RerankService();
  });

  // Helper to create ad candidate
  function createCandidate(overrides: Partial<AdCandidate> = {}): AdCandidate {
    return {
      campaign_id: 1,
      creative_id: 1,
      advertiser_id: 1,
      bid: 1.0,
      bid_type: 1,
      score: 1.0,
      ...overrides,
    };
  }

  describe('execute', () => {
    it('should return empty array when no candidates', async () => {
      const result = await service.execute([], {});
      expect(result).toEqual([]);
    });

    it('should return limited number of candidates', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: 1 }),
        createCandidate({ campaign_id: 2, advertiser_id: 2 }),
        createCandidate({ campaign_id: 3, advertiser_id: 3 }),
      ];

      const result = await service.execute(candidates, {}, { limit: 2 });
      expect(result).toHaveLength(2);
    });

    it('should use default limit of 10 when not specified', async () => {
      const candidates = Array.from({ length: 15 }, (_, i) =>
        createCandidate({ campaign_id: i + 1, advertiser_id: i + 1 })
      );

      const result = await service.execute(candidates, {});
      expect(result).toHaveLength(10);
    });

    it('should preserve rank order', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: 1, score: 3.0 }),
        createCandidate({ campaign_id: 2, advertiser_id: 2, score: 2.0 }),
        createCandidate({ campaign_id: 3, advertiser_id: 3, score: 1.0 }),
      ];

      const result = await service.execute(candidates, {}, { limit: 3 });
      expect(result).toHaveLength(3);
      expect(result[0].campaign_id).toBe(1);
      expect(result[1].campaign_id).toBe(2);
      expect(result[2].campaign_id).toBe(3);
    });
  });

  describe('Diversity Rule (Max 2 per Advertiser)', () => {
    it('should limit to 2 candidates per advertiser', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: 1, score: 5.0 }),
        createCandidate({ campaign_id: 2, advertiser_id: 1, score: 4.0 }),
        createCandidate({ campaign_id: 3, advertiser_id: 1, score: 3.0 }),
        createCandidate({ campaign_id: 4, advertiser_id: 1, score: 2.0 }),
      ];

      const result = await service.execute(candidates, {}, { limit: 10 });
      expect(result).toHaveLength(2);
      expect(result[0].campaign_id).toBe(1);
      expect(result[1].campaign_id).toBe(2);
    });

    it('should allow multiple advertisers', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: 1 }),
        createCandidate({ campaign_id: 2, advertiser_id: 1 }),
        createCandidate({ campaign_id: 3, advertiser_id: 2 }),
        createCandidate({ campaign_id: 4, advertiser_id: 2 }),
        createCandidate({ campaign_id: 5, advertiser_id: 3 }),
      ];

      const result = await service.execute(candidates, {}, { limit: 10 });
      expect(result).toHaveLength(5);
    });

    it('should skip candidates when advertiser limit reached', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: 1, score: 5.0 }),
        createCandidate({ campaign_id: 2, advertiser_id: 1, score: 4.0 }),
        createCandidate({ campaign_id: 3, advertiser_id: 1, score: 3.0 }), // Should be skipped
        createCandidate({ campaign_id: 4, advertiser_id: 2, score: 2.0 }),
      ];

      const result = await service.execute(candidates, {}, { limit: 10 });
      expect(result).toHaveLength(3);
      expect(result.map(c => c.campaign_id)).toEqual([1, 2, 4]);
    });

    it('should handle mixed advertisers correctly', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: 1 }), // Adv 1: 1st
        createCandidate({ campaign_id: 2, advertiser_id: 2 }), // Adv 2: 1st
        createCandidate({ campaign_id: 3, advertiser_id: 1 }), // Adv 1: 2nd
        createCandidate({ campaign_id: 4, advertiser_id: 2 }), // Adv 2: 2nd
        createCandidate({ campaign_id: 5, advertiser_id: 1 }), // Adv 1: 3rd - skipped
        createCandidate({ campaign_id: 6, advertiser_id: 3 }), // Adv 3: 1st
      ];

      const result = await service.execute(candidates, {}, { limit: 10 });
      expect(result).toHaveLength(5);
      expect(result.map(c => c.campaign_id)).toEqual([1, 2, 3, 4, 6]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single candidate', async () => {
      const candidates = [createCandidate({ campaign_id: 1 })];
      const result = await service.execute(candidates, {}, { limit: 10 });
      expect(result).toHaveLength(1);
    });

    it('should handle limit of 1', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1 }),
        createCandidate({ campaign_id: 2 }),
      ];
      const result = await service.execute(candidates, {}, { limit: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].campaign_id).toBe(1);
    });

    it('should handle limit larger than candidates', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1 }),
        createCandidate({ campaign_id: 2 }),
      ];
      const result = await service.execute(candidates, {}, { limit: 100 });
      expect(result).toHaveLength(2);
    });

    it('should handle candidates without advertiser_id', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1, advertiser_id: undefined as any }),
        createCandidate({ campaign_id: 2, advertiser_id: undefined as any }),
      ];
      const result = await service.execute(candidates, {}, { limit: 10 });
      // undefined advertiser_id should be counted together
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
