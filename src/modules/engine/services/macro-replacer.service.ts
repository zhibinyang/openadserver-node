import { Injectable } from '@nestjs/common';
import { AdCandidate, UserContext } from '../../../shared/types';

export interface MacroContext {
    requestId: string;
    candidate: AdCandidate;
    userContext: UserContext;
    timestamp?: number;
}

/**
 * Service for replacing macros in URLs with actual runtime values.
 * Supports all common ad serving macros for tracking and attribution.
 */
@Injectable()
export class MacroReplacer {
    /**
     * Replace all macros in a URL with actual values from the context.
     * Macros use the format: ${MACRO_NAME}
     */
    replace(url: string, context: MacroContext): string {
        if (!url) return url;

        const macros = this.buildMacroMap(context);
        let result = url;

        // Replace all macros
        for (const [macro, value] of Object.entries(macros)) {
            const pattern = new RegExp(`\\$\\{${macro}\\}`, 'g');
            result = result.replace(pattern, encodeURIComponent(String(value)));
        }

        return result;
    }

    /**
     * Build a map of all available macros and their values.
     */
    private buildMacroMap(context: MacroContext): Record<string, string | number> {
        const { requestId, candidate, userContext, timestamp = Date.now() } = context;

        return {
            // Request Info
            REQUEST_ID: requestId,
            TIMESTAMP: timestamp,
            TIMESTAMP_MS: timestamp,
            TIMESTAMP_SEC: Math.floor(timestamp / 1000),

            // Ad Info
            AD_ID: `ad_${candidate.campaign_id}_${candidate.creative_id}`,
            CREATIVE_ID: candidate.creative_id,
            CAMPAIGN_ID: candidate.campaign_id,
            ADVERTISER_ID: candidate.advertiser_id,

            // Bid & Pricing
            BID: candidate.bid || 0,
            BID_TYPE: candidate.bid_type || 0,
            ECPM: candidate.ecpm || 0,

            // Creative Details
            CREATIVE_TYPE: candidate.creative_type || 0,
            CREATIVE_TITLE: candidate.title || '',
            CREATIVE_WIDTH: candidate.width || 0,
            CREATIVE_HEIGHT: candidate.height || 0,

            // User Context
            USER_ID: userContext.user_id || '',
            IP: userContext.ip || '',
            OS: userContext.os || '',
            COUNTRY: userContext.country || '',
            CITY: userContext.city || '',
            APP_ID: userContext.app_id || '',
            DEVICE_MODEL: userContext.device_model || '',

            // User Demographics (if available)
            AGE: userContext.age || '',
            GENDER: userContext.gender || '',

            // User Interests (comma-separated)
            INTERESTS: userContext.interests?.join(',') || '',

            // ML Scores (if available)
            PCTR: candidate.pctr || 0,
            PCVR: candidate.pcvr || 0,
            SCORE: candidate.score || 0,

            // Cache busting / Random
            CACHEBUSTER: Math.random().toString(36).substring(2, 15),
            RANDOM: Math.floor(Math.random() * 1000000000),
        };
    }

    /**
     * Get list of all supported macros (for documentation/validation).
     */
    getSupportedMacros(): string[] {
        return [
            'REQUEST_ID',
            'TIMESTAMP',
            'TIMESTAMP_MS',
            'TIMESTAMP_SEC',
            'AD_ID',
            'CREATIVE_ID',
            'CAMPAIGN_ID',
            'ADVERTISER_ID',
            'BID',
            'BID_TYPE',
            'ECPM',
            'CREATIVE_TYPE',
            'CREATIVE_TITLE',
            'CREATIVE_WIDTH',
            'CREATIVE_HEIGHT',
            'USER_ID',
            'IP',
            'OS',
            'COUNTRY',
            'CITY',
            'APP_ID',
            'DEVICE_MODEL',
            'AGE',
            'GENDER',
            'INTERESTS',
            'PCTR',
            'PCVR',
            'SCORE',
            'CACHEBUSTER',
            'RANDOM',
        ];
    }
}
