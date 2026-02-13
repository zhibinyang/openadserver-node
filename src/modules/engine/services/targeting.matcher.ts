
import { Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/types';
import { CachedRule } from './cache.service';

@Injectable()
export class TargetingMatcher {
    /**
     * Check if user context matches a list of rules.
     * Logic: Rules are ANDed together (must pass all).
     * Inside a rule, values are usually ORed (e.g. "US" or "CA").
     */
    match(rules: CachedRule[], context: UserContext): boolean {
        if (!rules || rules.length === 0) return true;

        for (const rule of rules) {
            if (!this.matchSingleRule(rule, context)) {
                return false;
            }
        }
        return true;
    }

    private matchSingleRule(rule: CachedRule, context: UserContext): boolean {
        const value = rule.rule_value as any; // JSON type
        const isInclude = rule.is_include ?? true;

        let matched = false;

        switch (rule.rule_type) {
            case 'geo':
                matched = this.matchGeo(value, context);
                break;
            case 'device':
                matched = this.matchDevice(value, context);
                break;
            case 'combined': {
                // Both geo and device must pass (AND)
                const hasGeo = value.countries || value.cities;
                const hasDevice = value.os || value.browser || value.device;
                const geoOk = hasGeo ? this.matchGeo(value, context) : true;
                const deviceOk = hasDevice ? this.matchDevice(value, context) : true;
                matched = geoOk && deviceOk;
                break;
            }
            default:
                return true;
        }

        return isInclude ? matched : !matched;
    }

    private matchGeo(value: any, context: UserContext): boolean {
        // Expected value: { countries: ["US", "CN"], cities: ["New York"] }
        if (value.countries && Array.isArray(value.countries)) {
            if (context.country && value.countries.includes(context.country)) {
                return true;
            }
        }
        if (value.cities && Array.isArray(value.cities)) {
            if (context.city && value.cities.includes(context.city)) {
                return true;
            }
        }
        // If geo rule exists but no match found
        return false;
    }

    private matchDevice(value: any, context: UserContext): boolean {
        // Expected value: { os: ["ios", "android"], browser: ["chrome"], device: ["iphone"] }

        let matched = true;

        // 1. OS Match
        if (value.os && Array.isArray(value.os)) {
            if (!context.os || !value.os.includes(context.os.toLowerCase())) {
                matched = false;
            }
        }

        // 2. Browser Match
        if (matched && value.browser && Array.isArray(value.browser)) {
            if (!context.browser || !value.browser.includes(context.browser.toLowerCase())) {
                matched = false;
            }
        }

        // 3. Device Model Match
        if (matched && value.device && Array.isArray(value.device)) {
            // Partial match? or Exact? Let's do partial includes for now
            if (!context.device) {
                matched = false;
            } else {
                const deviceLower = context.device.toLowerCase();
                const anyMatch = value.device.some((d: string) => deviceLower.includes(d.toLowerCase()));
                if (!anyMatch) matched = false;
            }
        }

        return matched;
    }
}
