import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';

@Injectable()
export class CalibrationService {
    private readonly logger = new Logger(CalibrationService.name);

    constructor(private readonly redisService: RedisService) { }

    /**
     * Storage structure:
     * Using hourly hash buckets with 48h expiration to implement the 24h sliding window natively,
     * avoiding unbounded hash growth.
     */
    private getHourKey(campaignId: number, slotId: string, offsetHours: number = 0): string {
        const d = new Date(Date.now() - offsetHours * 3600 * 1000);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        return `calib:${campaignId}:${slotId}:${yyyy}${mm}${dd}${hh}`;
    }

    async logImpression(campaignId: number, slotId: string, pctr: number) {
        if (!campaignId || !slotId) return;
        const key = this.getHourKey(campaignId, slotId);
        await this.redisService.hincrbyfloat(key, 'expected_clicks', pctr);
        await this.redisService.expire(key, 48 * 3600); // Expiration effectively cleans up outside sliding window
    }

    async logClick(campaignId: number, slotId: string, pcvr: number) {
        if (!campaignId || !slotId) return;
        const key = this.getHourKey(campaignId, slotId);
        await this.redisService.hincrby(key, 'actual_clicks', 1);
        await this.redisService.hincrbyfloat(key, 'expected_convs', pcvr);
        await this.redisService.expire(key, 48 * 3600);
    }

    async logConversion(campaignId: number, slotId: string) {
        if (!campaignId || !slotId) return;
        const key = this.getHourKey(campaignId, slotId);
        await this.redisService.hincrby(key, 'actual_convs', 1);
        await this.redisService.expire(key, 48 * 3600);
    }

    async getCalibratedPredictions(campaignId: number, slotId: string, pctr: number, pcvr: number): Promise<{ pctr: number, pcvr: number, ctr_factor: number, cvr_factor: number }> {
        if (!campaignId || !slotId) return { pctr, pcvr, ctr_factor: 1, cvr_factor: 1 };

        let expected_clicks = 0;
        let actual_clicks = 0;
        let expected_convs = 0;
        let actual_convs = 0;

        try {
            const pipeline = this.redisService.client.pipeline();
            for (let i = 0; i < 24; i++) {
                const key = this.getHourKey(campaignId, slotId, i);
                pipeline.hgetall(key);
            }
            const results = await pipeline.exec();

            if (results) {
                for (const [err, data] of results) {
                    if (data && !err) {
                        expected_clicks += parseFloat((data as any).expected_clicks || '0');
                        actual_clicks += parseFloat((data as any).actual_clicks || '0');
                        expected_convs += parseFloat((data as any).expected_convs || '0');
                        actual_convs += parseFloat((data as any).actual_convs || '0');
                    }
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to fetch calibration data for campaign ${campaignId}: ${error}`);
        }

        const ctr_factor_raw = (actual_clicks + 10) / (expected_clicks + 10);
        const ctr_factor = Math.max(0.2, Math.min(2.0, ctr_factor_raw));

        const cvr_factor_raw = (actual_convs + 10) / (expected_convs + 10);
        const cvr_factor = Math.max(0.2, Math.min(2.0, cvr_factor_raw));

        return {
            pctr: pctr * ctr_factor,
            pcvr: pcvr * cvr_factor,
            ctr_factor,
            cvr_factor
        };
    }
}
