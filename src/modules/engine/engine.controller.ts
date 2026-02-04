
import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AdEngine } from './ad-engine.service';
import { AdRequestDto } from './dto/ad-request.dto';
import { UserContext } from '../../shared/types';

@Controller('ad')
export class EngineController {
    constructor(private readonly adEngine: AdEngine) { }

    @Post('get')
    @HttpCode(HttpStatus.OK)
    async getAds(@Body() dto: AdRequestDto) {
        // Map DTO to UserContext
        // In a real app, we might use a proper mapper or value object
        const context: UserContext = {
            user_id: dto.user_id,
            ip: dto.ip || '127.0.0.1',
            os: dto.os || 'unknown',
            country: dto.country || 'US', // Default for dev
            city: dto.city,
            app_id: dto.app_id || 'default_app',
            device_model: dto.device_model,
            age: dto.age,
            gender: dto.gender,
            interests: dto.interests,
        };

        const candidates = await this.adEngine.recommend(context, dto.slot_id);
        const numAds = Math.min(dto.num_ads || 1, 10); // Max 10 ads

        // Base URL for absolute tracking pixels
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

        return {
            request_id: crypto.randomUUID(),
            candidates: candidates.slice(0, numAds).map(c => ({
                // Expose only necessary fields to client
                ad_id: `ad_${c.campaign_id}_${c.creative_id}`,
                creative_id: c.creative_id,
                campaign_id: c.campaign_id,
                title: c.title,
                description: c.description,
                image_url: c.image_url,
                video_url: c.video_url,
                landing_url: c.landing_url,
                imp_pixel: `${baseUrl}/track?type=imp&cid=${c.campaign_id}&crid=${c.creative_id}&uid=${dto.user_id || ''}`,
                click_pixel: `${baseUrl}/track?type=click&cid=${c.campaign_id}&crid=${c.creative_id}&uid=${dto.user_id || ''}`,
                conversion_pixel: `${baseUrl}/track?type=conversion&cid=${c.campaign_id}&crid=${c.creative_id}&uid=${dto.user_id || ''}`,
            })),
        };
    }
}
