/**
 * EmbeddingService Unit Tests
 * Tests for Gemini embedding generation with Redis caching
 */

import { EmbeddingService } from '../../../src/modules/geo/services/embedding.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../src/shared/redis/redis.service';

// Mock GoogleGenAI
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockAi: { models: { embedContent: jest.Mock } };

  beforeEach(async () => {
    mockAi = {
      models: {
        embedContent: jest.fn(),
      },
    };

    const { GoogleGenAI } = require('@google/genai');
    GoogleGenAI.mockImplementation(() => mockAi);

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string | number) => {
        const config: Record<string, string | number> = {
          GEMINI_API_KEY: 'test-api-key',
          GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
          EMBEDDING_CACHE_TTL: 86400,
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    } as any;

    service = new EmbeddingService(mockConfigService, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with configured model and cache TTL', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_API_KEY', '');
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
      expect(mockConfigService.get).toHaveBeenCalledWith('EMBEDDING_CACHE_TTL', 86400);
    });

    it('should use default model if not configured', () => {
      mockConfigService.get = jest.fn((key: string, defaultValue?: string | number) => {
        if (key === 'GEMINI_API_KEY') return 'test-key';
        return defaultValue;
      });

      const newService = new EmbeddingService(mockConfigService, mockRedisService);
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
    });
  });

  describe('embed', () => {
    it('should return embedding vector for valid text (cache miss)', async () => {
      const mockVector = new Array(3072).fill(0.1);
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [{ values: mockVector }],
      });

      const result = await service.embed('test query');

      expect(result).toHaveLength(3072);
      expect(mockAi.models.embedContent).toHaveBeenCalledWith({
        model: 'gemini-embedding-001',
        contents: 'test query',
      });
      // Should cache the result
      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should return cached embedding on cache hit', async () => {
      const cachedVector = new Array(3072).fill(0.5);
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(cachedVector));

      const result = await service.embed('test query');

      expect(result).toHaveLength(3072);
      expect(result).toEqual(cachedVector);
      // Should NOT call the API when cache hit
      expect(mockAi.models.embedContent).not.toHaveBeenCalled();
    });

    it('should handle Redis cache read failure gracefully', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis connection error'));
      const mockVector = new Array(3072).fill(0.1);
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [{ values: mockVector }],
      });

      const result = await service.embed('test query');

      // Should still return result from API
      expect(result).toHaveLength(3072);
      expect(mockAi.models.embedContent).toHaveBeenCalled();
    });

    it('should handle Redis cache write failure gracefully', async () => {
      mockRedisService.set.mockRejectedValueOnce(new Error('Redis write error'));
      const mockVector = new Array(3072).fill(0.1);
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [{ values: mockVector }],
      });

      const result = await service.embed('test query');

      // Should still return result even if caching fails
      expect(result).toHaveLength(3072);
    });

    it('should throw error when API returns empty vector', async () => {
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [{ values: [] }],
      });

      await expect(service.embed('test query')).rejects.toThrow('Embedding API returned empty vector');
    });

    it('should throw error when API returns no embeddings', async () => {
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [],
      });

      await expect(service.embed('test query')).rejects.toThrow('Embedding API returned empty vector');
    });

    it('should throw error when embeddings is undefined', async () => {
      mockAi.models.embedContent.mockResolvedValue({});

      await expect(service.embed('test query')).rejects.toThrow('Embedding API returned empty vector');
    });

    it('should handle special characters in text', async () => {
      const mockVector = new Array(3072).fill(0.2);
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [{ values: mockVector }],
      });

      const specialText = '测试查询 <script>alert("xss")</script> \n\t特殊字符';
      const result = await service.embed(specialText);

      expect(result).toHaveLength(3072);
      expect(mockAi.models.embedContent).toHaveBeenCalledWith({
        model: 'gemini-embedding-001',
        contents: specialText,
      });
    });

    it('should handle long text input', async () => {
      const mockVector = new Array(3072).fill(0.3);
      mockAi.models.embedContent.mockResolvedValue({
        embeddings: [{ values: mockVector }],
      });

      const longText = 'a'.repeat(10000);
      const result = await service.embed(longText);

      expect(result).toHaveLength(3072);
    });

    it('should use different cache keys for different texts', async () => {
      const mockVector1 = new Array(3072).fill(0.1);
      const mockVector2 = new Array(3072).fill(0.2);
      mockAi.models.embedContent
        .mockResolvedValueOnce({ embeddings: [{ values: mockVector1 }] })
        .mockResolvedValueOnce({ embeddings: [{ values: mockVector2 }] });

      await service.embed('query one');
      await service.embed('query two');

      // Both should call API since different texts = different cache keys
      expect(mockAi.models.embedContent).toHaveBeenCalledTimes(2);
    });

    it('should use same cache key for same text', async () => {
      const cachedVector = new Array(3072).fill(0.5);
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(cachedVector));

      await service.embed('same query');

      // Should use cache and not call API
      expect(mockAi.models.embedContent).not.toHaveBeenCalled();
    });
  });
});
