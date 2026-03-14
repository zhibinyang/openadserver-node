/**
 * RankingService Unit Tests
 * Tests for the eCPM calculation and ranking logic
 */

import { RankingService } from '../../../src/modules/engine/pipeline/4-ranking.service';
import { AdCandidate, BidType } from '../../../src/shared/types';
import { createTestCampaign } from '../../fixtures';

describe('RankingService', () => {
  let service: RankingService;

  beforeEach(() => {
    service = new RankingService();
  });

  // Helper to create ad candidate
  function createCandidate(overrides: Partial<AdCandidate> = {}): AdCandidate {
    return {
      campaign_id: 1,
      creative_id: 1,
      bid: 1.0,
      bid_type: BidType.CPM,
      pctr: 0.02,
      pcvr: 0.1,
      ...overrides,
    };
  }

  describe('execute', () => {
    it('should return empty array when no candidates', () => {
      const result = service.execute([], {});
      expect(result).toEqual([]);
    });

    it('should calculate eCPM for single candidate', () => {
      const candidates = [createCandidate({ bid: 2.5, bid_type: BidType.CPM })];
      const result = service.execute(candidates, {});

      expect(result).toHaveLength(1);
      expect(result[0].ecpm).toBe(2.5);
      expect(result[0].score).toBe(2.5);
    });

    it('should sort candidates by eCPM descending', () => {
      const candidates = [
        createCandidate({ campaign_id: 1, bid: 1.0, bid_type: BidType.CPM }),
        createCandidate({ campaign_id: 2, bid: 3.0, bid_type: BidType.CPM }),
        createCandidate({ campaign_id: 3, bid: 2.0, bid_type: BidType.CPM }),
      ];
      const result = service.execute(candidates, {});

      expect(result).toHaveLength(3);
      expect(result[0].campaign_id).toBe(2); // Highest bid
      expect(result[1].campaign_id).toBe(3);
      expect(result[2].campaign_id).toBe(1); // Lowest bid
    });
  });

  describe('eCPM Calculation', () => {
    it('should calculate eCPM for CPM bid type', () => {
      const candidates = [createCandidate({ bid: 5.0, bid_type: BidType.CPM })];
      const result = service.execute(candidates, {});

      // CPM: eCPM = bid
      expect(result[0].ecpm).toBe(5.0);
    });

    it('should calculate eCPM for CPC bid type', () => {
      const candidates = [createCandidate({
        bid: 0.5,
        bid_type: BidType.CPC,
        pctr: 0.02, // 2% CTR
      })];
      const result = service.execute(candidates, {});

      // CPC: eCPM = bid * pCTR * 1000
      // 0.5 * 0.02 * 1000 = 10
      expect(result[0].ecpm).toBeCloseTo(10, 2);
    });

    it('should calculate eCPM for CPA bid type', () => {
      const candidates = [createCandidate({
        bid: 10.0,
        bid_type: BidType.CPA,
        pctr: 0.02,
        pcvr: 0.1,
      })];
      const result = service.execute(candidates, {});

      // CPA: eCPM = bid * pCTR * pCVR * 1000
      // 10 * 0.02 * 0.1 * 1000 = 20
      expect(result[0].ecpm).toBeCloseTo(20, 2);
    });

    it('should calculate eCPM for OCPM bid type', () => {
      const candidates = [createCandidate({
        bid: 15.0,
        bid_type: BidType.OCPM,
        pctr: 0.03,
        pcvr: 0.05,
      })];
      const result = service.execute(candidates, {});

      // OCPM: eCPM = bid * pCTR * pCVR * 1000
      // 15 * 0.03 * 0.05 * 1000 = 22.5
      expect(result[0].ecpm).toBeCloseTo(22.5, 2);
    });

    it('should use default pCTR/pCVR when not provided', () => {
      const candidates = [createCandidate({
        bid: 1.0,
        bid_type: BidType.CPC,
        pctr: undefined,
        pcvr: undefined,
      })];
      const result = service.execute(candidates, {});

      // Should use default values (0.0001)
      expect(result[0].ecpm).toBeDefined();
      expect(result[0].ecpm).toBeGreaterThan(0);
    });
  });

  describe('Generalized Second Price (GSP)', () => {
    it('should set actual_cost to second highest eCPM for CPM', () => {
      const candidates = [
        createCandidate({ campaign_id: 1, bid: 5.0, bid_type: BidType.CPM }),
        createCandidate({ campaign_id: 2, bid: 3.0, bid_type: BidType.CPM }),
      ];
      const result = service.execute(candidates, {});

      // Winner pays second price
      expect(result[0].campaign_id).toBe(1);
      expect(result[0].actual_cost).toBe(3.0); // Second highest bid
    });

    it('should set actual_cost to floor (0.01) when only one candidate', () => {
      const candidates = [createCandidate({ bid: 5.0, bid_type: BidType.CPM })];
      const result = service.execute(candidates, {});

      expect(result[0].actual_cost).toBe(0.01);
    });

    it('should not exceed actual bid for actual_cost', () => {
      const candidates = [
        createCandidate({ campaign_id: 1, bid: 2.0, bid_type: BidType.CPM }),
        createCandidate({ campaign_id: 2, bid: 10.0, bid_type: BidType.CPM }), // This would try to charge 10
      ];
      const result = service.execute(candidates, {});

      // Winner (campaign 2) should pay min(bid, second_price)
      expect(result[0].campaign_id).toBe(2);
      expect(result[0].actual_cost).toBe(2.0); // Capped at second price
    });

    it('should calculate GSP for CPC correctly', () => {
      const candidates = [
        createCandidate({
          campaign_id: 1,
          bid: 1.0,
          bid_type: BidType.CPC,
          pctr: 0.02,
        }),
        createCandidate({
          campaign_id: 2,
          bid: 0.5,
          bid_type: BidType.CPC,
          pctr: 0.02,
        }),
      ];
      const result = service.execute(candidates, {});

      // Winner (campaign 1) eCPM = 1.0 * 0.02 * 1000 = 20
      // Second eCPM = 0.5 * 0.02 * 1000 = 10
      // actual_cost = next_eCPM / (pCTR * 1000) = 10 / (0.02 * 1000) = 0.5
      expect(result[0].campaign_id).toBe(1);
      expect(result[0].actual_cost).toBeCloseTo(0.5, 2);
    });
  });

  describe('Mixed Bid Types', () => {
    it('should rank mixed bid types correctly', () => {
      const candidates = [
        createCandidate({
          campaign_id: 1,
          bid: 2.0,
          bid_type: BidType.CPM, // eCPM = 2.0
        }),
        createCandidate({
          campaign_id: 2,
          bid: 0.5,
          bid_type: BidType.CPC,
          pctr: 0.01, // eCPM = 0.5 * 0.01 * 1000 = 5.0
        }),
        createCandidate({
          campaign_id: 3,
          bid: 10.0,
          bid_type: BidType.CPA,
          pctr: 0.02,
          pcvr: 0.05, // eCPM = 10 * 0.02 * 0.05 * 1000 = 10.0
        }),
      ];
      const result = service.execute(candidates, {});

      expect(result[0].campaign_id).toBe(3); // eCPM = 10
      expect(result[1].campaign_id).toBe(2); // eCPM = 5
      expect(result[2].campaign_id).toBe(1); // eCPM = 2
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero bid', () => {
      const candidates = [createCandidate({ bid: 0, bid_type: BidType.CPM })];
      const result = service.execute(candidates, {});

      expect(result[0].ecpm).toBe(0);
    });

    it('should handle very low pCTR', () => {
      const candidates = [createCandidate({
        bid: 1.0,
        bid_type: BidType.CPC,
        pctr: 0.0001, // Very low
      })];
      const result = service.execute(candidates, {});

      expect(result[0].ecpm).toBeDefined();
      expect(result[0].ecpm).toBeGreaterThanOrEqual(0);
    });

    it('should handle very high pCTR', () => {
      const candidates = [createCandidate({
        bid: 1.0,
        bid_type: BidType.CPC,
        pctr: 0.5, // 50% CTR - very high
      })];
      const result = service.execute(candidates, {});

      // eCPM = 1.0 * 0.5 * 1000 = 500
      expect(result[0].ecpm).toBe(500);
    });

    it('should handle unknown bid type', () => {
      const candidates = [createCandidate({ bid: 1.0, bid_type: 999 as any })];
      const result = service.execute(candidates, {});

      expect(result[0].ecpm).toBe(0);
    });
  });
});
