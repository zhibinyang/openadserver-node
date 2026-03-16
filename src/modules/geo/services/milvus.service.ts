import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'geo_vectors';
const VECTOR_DIM = 3072;

export interface MilvusSearchResult {
    creative_id: number;
    campaign_id: number;
    knowledge_id: number;
    score: number;
}

@Injectable()
export class MilvusService implements OnModuleInit {
    private readonly logger = new Logger(MilvusService.name);
    private client: MilvusClient;

    constructor(private configService: ConfigService) {}

    async onModuleInit() {
        const host = this.configService.get<string>('MILVUS_HOST', 'localhost');
        const port = this.configService.get<string>('MILVUS_PORT', '19530');
        const address = `${host}:${port}`;

        this.logger.log(`Connecting to Milvus at ${address}...`);
        this.client = new MilvusClient({ address });

        await this.ensureCollection();
        this.logger.log('Milvus connection and collection ready.');
    }

    private async ensureCollection() {
        const hasCollection = await this.client.hasCollection({
            collection_name: COLLECTION_NAME,
        });

        if (!hasCollection.value) {
            this.logger.log(`Creating collection: ${COLLECTION_NAME}`);
            await this.client.createCollection({
                collection_name: COLLECTION_NAME,
                fields: [
                    { name: 'pk', data_type: DataType.Int64, is_primary_key: true, autoID: true },
                    { name: 'knowledge_id', data_type: DataType.Int64 },
                    { name: 'creative_id', data_type: DataType.Int64 },
                    { name: 'campaign_id', data_type: DataType.Int64 },
                    { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM },
                    { name: 'updated_at', data_type: DataType.Int64 },
                ],
            });

            await this.client.createIndex({
                collection_name: COLLECTION_NAME,
                field_name: 'vector',
                index_type: 'IVF_FLAT',
                metric_type: 'COSINE',
                params: { nlist: 128 },
            });
        }

        await this.client.loadCollection({ collection_name: COLLECTION_NAME });
    }

    async search(vector: number[], topK: number = 50, filter?: string): Promise<MilvusSearchResult[]> {
        const searchParams: any = {
            collection_name: COLLECTION_NAME,
            vector,
            limit: topK,
            output_fields: ['knowledge_id', 'creative_id', 'campaign_id'],
            params: { nprobe: 16 },
        };
        if (filter) searchParams.filter = filter;

        const result = await this.client.search(searchParams);
        return (result.results || []).map((hit: any) => ({
            knowledge_id: Number(hit.knowledge_id),
            creative_id: Number(hit.creative_id),
            campaign_id: Number(hit.campaign_id),
            score: hit.score,
        }));
    }
}
