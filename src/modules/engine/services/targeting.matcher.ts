
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
            // Add more rule types here (age, gender, interest)
            default:
                // Unknown rule type, safe to ignore or strict fail? 
                // Typically legacy safe: ignore -> true. 
                // But here we assume strict control -> false if unknown?
                // Let's assume ignore for now to prevent outage on new rule types.
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
