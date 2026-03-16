/**
 * EmbeddingService Unit Tests
 * Tests for Gemini embedding generation
 */

import { EmbeddingService } from '../../../src/modules/geo/services/embedding.service';
import { ConfigService } from '@nestjs/config';

// Mock GoogleGenAI
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockConfigService: jest.Mocked<ConfigService>;
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
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          GEMINI_API_KEY: 'test-api-key',
          GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new EmbeddingService(mockConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with configured model', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_API_KEY', '');
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
    });

    it('should use default model if not configured', () => {
      mockConfigService.get = jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-key';
        return defaultValue;
      });

      const newService = new EmbeddingService(mockConfigService);
      expect(mockConfigService.get).toHaveBeenCalledWith('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
    });
  });

  describe('embed', () => {
    it('should return embedding vector for valid text', async () => {
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
  });
});
