/**
 * MilvusService Unit Tests
 * Tests for Milvus vector database operations
 */

import { MilvusService, MilvusSearchResult } from '../../../src/modules/geo/services/milvus.service';
import { ConfigService } from '@nestjs/config';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

// Mock MilvusClient
jest.mock('@zilliz/milvus2-sdk-node', () => ({
  MilvusClient: jest.fn(),
  DataType: {
    Int64: 5,
    FloatVector: 101,
  },
}));

describe('MilvusService', () => {
  let service: MilvusService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockClient: jest.Mocked<MilvusClient>;

  beforeEach(async () => {
    // Create mock client
    mockClient = {
      hasCollection: jest.fn().mockResolvedValue({ value: false }),
      createCollection: jest.fn().mockResolvedValue({}),
      createIndex: jest.fn().mockResolvedValue({}),
      loadCollection: jest.fn().mockResolvedValue({}),
      search: jest.fn().mockResolvedValue({ results: [] }),
    } as any;

    (MilvusClient as jest.Mock).mockImplementation(() => mockClient);

    // Create mock ConfigService
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          MILVUS_HOST: 'localhost',
          MILVUS_PORT: '19530',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new MilvusService(mockConfigService);
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to Milvus with configured host and port', () => {
      expect(MilvusClient).toHaveBeenCalledWith({
        address: 'localhost:19530',
      });
    });

    it('should create collection if not exists', () => {
      expect(mockClient.hasCollection).toHaveBeenCalledWith({
        collection_name: 'geo_vectors',
      });
      expect(mockClient.createCollection).toHaveBeenCalled();
    });

    it('should not create collection if already exists', async () => {
      // Reset the mock to clear previous call counts
      mockClient.createCollection.mockClear();
      mockClient.hasCollection.mockResolvedValueOnce({ value: true });

      const newService = new MilvusService(mockConfigService);
      await newService.onModuleInit();

      expect(mockClient.createCollection).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should return empty array when no results', async () => {
      mockClient.search.mockResolvedValueOnce({ results: [] });

      const vector = new Array(3072).fill(0.1);
      const result = await service.search(vector, 10);

      expect(result).toEqual([]);
    });

    it('should return mapped search results', async () => {
      const mockResults = [
        {
          knowledge_id: '1',
          creative_id: '100',
          campaign_id: '10',
          score: 0.95,
        },
        {
          knowledge_id: '2',
          creative_id: '101',
          campaign_id: '11',
          score: 0.85,
        },
      ];

      mockClient.search.mockResolvedValueOnce({ results: mockResults });

      const vector = new Array(3072).fill(0.1);
      const result = await service.search(vector, 50);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        knowledge_id: 1,
        creative_id: 100,
        campaign_id: 10,
        score: 0.95,
      });
      expect(result[1]).toEqual({
        knowledge_id: 2,
        creative_id: 101,
        campaign_id: 11,
        score: 0.85,
      });
    });

    it('should pass filter parameter when provided', async () => {
      mockClient.search.mockResolvedValueOnce({ results: [] });

      const vector = new Array(3072).fill(0.1);
      await service.search(vector, 10, 'campaign_id > 0');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: 'campaign_id > 0',
        })
      );
    });

    it('should use correct search parameters', async () => {
      mockClient.search.mockResolvedValueOnce({ results: [] });

      const vector = new Array(3072).fill(0.1);
      await service.search(vector, 25);

      expect(mockClient.search).toHaveBeenCalledWith({
        collection_name: 'geo_vectors',
        vector,
        limit: 25,
        output_fields: ['knowledge_id', 'creative_id', 'campaign_id'],
        params: { nprobe: 16 },
      });
    });

    it('should handle malformed results gracefully', async () => {
      const mockResults = [
        {
          knowledge_id: null,
          creative_id: '100',
          campaign_id: '10',
          score: 0.95,
        },
      ];

      mockClient.search.mockResolvedValueOnce({ results: mockResults });

      const vector = new Array(3072).fill(0.1);
      const result = await service.search(vector, 10);

      expect(result[0].knowledge_id).toBe(0);
    });
  });
});
