/**
 * GeoScoringService Unit Tests
 * Tests for AI-based relevance scoring
 */

import { GeoScoringService } from '../../../src/modules/geo/services/geo-scoring.service';
import { ConfigService } from '@nestjs/config';

// Mock GoogleGenAI
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

describe('GeoScoringService', () => {
  let service: GeoScoringService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockAi: { models: { generateContent: jest.Mock } };

  beforeEach(async () => {
    mockAi = {
      models: {
        generateContent: jest.fn(),
      },
    };

    const { GoogleGenAI } = require('@google/genai');
    GoogleGenAI.mockImplementation(() => mockAi);

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          GEMINI_API_KEY: 'test-api-key',
          GEMINI_LLM_MODEL: 'gemini-3.1-flash-lite-preview',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new GeoScoringService(mockConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with configured model', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_API_KEY', '');
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_LLM_MODEL', 'gemini-3.1-flash-lite-preview');
    });

    it('should use default model if not configured', () => {
      mockConfigService.get = jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-key';
        return defaultValue;
      });

      const newService = new GeoScoringService(mockConfigService);
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_LLM_MODEL', 'gemini-3.1-flash-lite-preview');
    });
  });

  describe('scoreRelevance', () => {
    it('should return valid score between 0 and 1', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '0.85',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0.85);
      expect(mockAi.models.generateContent).toHaveBeenCalled();
    });

    it('should return 0 for invalid score format', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: 'invalid',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0);
    });

    it('should return 0 for score below 0', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '-0.5',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0);
    });

    it('should return 0 for score above 1', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '1.5',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0);
    });

    it('should return 0 when API returns empty text', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0);
    });

    it('should return 0 when API throws error', async () => {
      mockAi.models.generateContent.mockRejectedValue(new Error('API error'));

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0);
    });

    it('should handle score with whitespace', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '  0.75  ',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0.75);
    });

    it('should handle integer score', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '1',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(1);
    });

    it('should handle zero score', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '0',
      });

      const result = await service.scoreRelevance('test query', 'test snippet');

      expect(result).toBe(0);
    });

    it('should include query and snippet in prompt', async () => {
      mockAi.models.generateContent.mockResolvedValue({
        text: '0.5',
      });

      await service.scoreRelevance('用户问题', '知识片段内容');

      const callArg = mockAi.models.generateContent.mock.calls[0][0];
      expect(callArg.contents).toContain('用户问题');
      expect(callArg.contents).toContain('知识片段内容');
    });
  });
});
