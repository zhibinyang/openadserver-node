import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeoScoringService {
    private readonly logger = new Logger(GeoScoringService.name);
    private ai: GoogleGenAI;
    private model: string;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
        this.model = this.configService.get<string>('GEMINI_LLM_MODEL', 'gemini-3.1-flash-lite-preview');
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log(`GeoScoringService initialized with model: ${this.model}`);
    }

    async scoreRelevance(query: string, snippet: string): Promise<number> {
        const prompt = `你是广告内容审核员。判断以下知识片段能否自然回答用户问题。
用户问题: "${query}"
知识片段: "${snippet}"

只返回 0 到 1 之间的一个数字，代表自然度评分。不要输出任何其他内容，只输出数字。`;

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: prompt,
            });

            const text = response.text?.trim() || '0';
            const score = parseFloat(text);

            if (isNaN(score) || score < 0 || score > 1) {
                this.logger.warn(`Invalid score: "${text}", defaulting to 0`);
                return 0;
            }

            this.logger.debug(`Relevance score: ${score}`);
            return score;
        } catch (error) {
            this.logger.error(`GeoScoring failed: ${error}`);
            return 0;
        }
    }
}
