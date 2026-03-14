/**
 * PredictionService Unit Tests
 * Tests for the prediction service with mocked ONNX runtime
 */

import { PredictionService } from '../../../src/modules/engine/pipeline/3-prediction.service';
import { CalibrationService } from '../../../src/modules/engine/services/calibration.service';
import { AdCandidate } from '../../../src/shared/types';

describe('PredictionService', () => {
  let service: PredictionService;
  let mockCalibrationService: jest.Mocked<CalibrationService>;

  // Helper to create ad candidate
  function createCandidate(overrides: Partial<AdCandidate> = {}): AdCandidate {
    return {
      campaign_id: 1,
      creative_id: 1,
      bid: 1.0,
      bid_type: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    // Mock calibration service
    mockCalibrationService = {
      calibratePctr: jest.fn().mockImplementation((pctr) => pctr),
      calibratePcvr: jest.fn().mockImplementation((pcvr) => pcvr),
    } as any;

    // Create service with mocked dependencies
    service = new PredictionService(mockCalibrationService);
  });

  describe('execute', () => {
    it('should return empty array when no candidates', async () => {
      const result = await service.execute([], {});
      expect(result).toEqual([]);
    });

    it('should add pctr and pcvr to candidates', async () => {
      const candidates = [createCandidate()];
      const result = await service.execute(candidates, {});

      expect(result).toHaveLength(1);
      expect(result[0].pctr).toBeDefined();
      expect(result[0].pcvr).toBeDefined();
      expect(result[0].pctr).toBeGreaterThan(0);
      expect(result[0].pcvr).toBeGreaterThan(0);
    });

    it('should use heuristic fallback when model not loaded', async () => {
      const candidates = [createCandidate()];
      const result = await service.execute(candidates, {});

      // Should have reasonable default values from heuristic
      expect(result[0].pctr).toBeGreaterThan(0);
      expect(result[0].pctr).toBeLessThan(1);
      expect(result[0].pcvr).toBeGreaterThan(0);
      expect(result[0].pcvr).toBeLessThan(1);
    });

    it('should process multiple candidates', async () => {
      const candidates = [
        createCandidate({ campaign_id: 1 }),
        createCandidate({ campaign_id: 2 }),
        createCandidate({ campaign_id: 3 }),
      ];

      const result = await service.execute(candidates, {});
      expect(result).toHaveLength(3);

      result.forEach((candidate) => {
        expect(candidate.pctr).toBeDefined();
        expect(candidate.pcvr).toBeDefined();
      });
    });
  });

  describe('Calibration Integration', () => {
    it('should process candidates successfully', async () => {
      const candidates = [createCandidate()];
      const result = await service.execute(candidates, {});

      // Service should process candidates and return predictions
      expect(result).toHaveLength(1);
      expect(result[0].pctr).toBeGreaterThan(0);
      expect(result[0].pcvr).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle candidate with existing pctr', async () => {
      const candidates = [createCandidate({ pctr: 0.05 })];
      const result = await service.execute(candidates, {});

      // Should still apply calibration or default
      expect(result[0].pctr).toBeDefined();
    });

    it('should handle context with user_id', async () => {
      const candidates = [createCandidate()];
      const context = { user_id: 'user-001' };

      const result = await service.execute(candidates, context);
      expect(result).toHaveLength(1);
    });

    it('should handle context with interests', async () => {
      const candidates = [createCandidate()];
      const context = { interests: ['tech', 'sports'] };

      const result = await service.execute(candidates, context);
      expect(result).toHaveLength(1);
    });
  });
});