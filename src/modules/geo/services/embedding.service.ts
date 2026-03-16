import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);
    private ai: GoogleGenAI;
    private model: string;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
        this.model = this.configService.get<string>('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log(`EmbeddingService initialized with model: ${this.model}`);
    }

    async embed(text: string): Promise<number[]> {
        const result = await this.ai.models.embedContent({
            model: this.model,
            contents: text,
        });

        const vector = result.embeddings?.[0]?.values;
        if (!vector || vector.length === 0) {
            throw new Error('Embedding API returned empty vector');
        }

        this.logger.debug(`Generated embedding: dim=${vector.length}`);
        return vector;
    }
}
