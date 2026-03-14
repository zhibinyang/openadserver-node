
import { Injectable } from '@nestjs/common';
import { UserContext, TargetingRuleType } from '../../../shared/types';
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
            case TargetingRuleType.GEO:
                matched = this.matchGeo(value, context);
                break;
            case TargetingRuleType.OS:
                // Backward compatibility: old 'os' rule was part of device rule
                matched = this.matchDevice({ os: value }, context);
                break;
            case TargetingRuleType.DEVICE:
                matched = this.matchDevice(value, context);
                break;
            case TargetingRuleType.BROWSER:
                // Backward compatibility: old 'browser' rule was part of device rule
                matched = this.matchDevice({ browser: value }, context);
                break;
            case TargetingRuleType.AGE:
                matched = this.matchAge(value, context);
                break;
            case TargetingRuleType.GENDER:
                matched = this.matchGender(value, context);
                break;
            case TargetingRuleType.INTEREST_INCLUDE:
                matched = this.matchInterests(value, context);
                break;
            case TargetingRuleType.INTEREST_EXCLUDE:
                // Exclude rule: reverse match result
                matched = !this.matchInterests(value, context);
                break;
            case 'demographics':
                matched = this.matchDemographics(value, context);
                break;
            case 'combined': {
                // Both geo and device must pass (AND)
                const hasGeo = value.countries || value.cities;
                const hasDevice = value.os || value.browser || value.device;
                const geoOk = hasGeo ? this.matchGeo(value, context) : true;
                const deviceOk = hasDevice ? this.matchDevice(value, context) : true;
                const demoOk = value.interests ? this.matchDemographics(value, context) : true;
                matched = geoOk && deviceOk && demoOk;
                break;
            }
            default:
                // Unknown rule type: pass to avoid breaking existing rules
                return true;
        }

        return isInclude ? matched : !matched;
    }

    /**
     * Match age range rule.
     * Supported formats: "20-30" (between 20 and 30 inclusive), "18-" (18 and above), "-40" (40 and below)
     */
    private matchAge(ageRange: any, context: UserContext): boolean {
        if (!context.age) return false; // No age info, can't match

        const userAge = context.age;
        if (isNaN(userAge) || userAge < 0 || userAge > 120) return false;
        if (typeof ageRange !== 'string') return false; // Invalid age range format

        // Handle different range formats
        if (ageRange.includes('-')) {
            const [minStr, maxStr] = ageRange.split('-', 2);
            const min = minStr ? parseInt(minStr, 10) : 0;
            const max = maxStr ? parseInt(maxStr, 10) : 120;

            return !isNaN(min) && !isNaN(max) && userAge >= min && userAge <= max;
        }

        // Exact age match
        const exactAge = parseInt(ageRange, 10);
        return !isNaN(exactAge) && userAge === exactAge;
    }

    /**
     * Match gender rule.
     * Supported values: "male", "female", "other"
     */
    private matchGender(gender: any, context: UserContext): boolean {
        if (!context.gender) return false; // No gender info, can't match
        if (!gender) return false;

        const userGender = context.gender.toLowerCase();
        const allowedGenders = Array.isArray(gender) ? gender : [String(gender)];

        return allowedGenders.some(g => g.toLowerCase() === userGender);
    }

    /**
     * Match interest rule: user has at least one of the specified interests.
     */
    private matchInterests(interests: any, context: UserContext): boolean {
        if (!context.interests || context.interests.length === 0) return false;
        if (!Array.isArray(interests) || interests.length === 0) return false;

        const userInterests = context.interests.map(i => String(i).toLowerCase());
        return interests.some(interest => userInterests.includes(String(interest).toLowerCase()));
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

    private matchDemographics(value: any, context: UserContext): boolean {
        // Expected value: { interests: ["tech", "sports"] }
        // If the rule specifies interests, the user MUST have at least ONE overlapping interest
        if (value.interests && Array.isArray(value.interests)) {
            if (!context.interests || context.interests.length === 0) {
                return false; // User has no interests, but rule requires some
            }
            // Check for intersection
            const hasCommonInterest = value.interests.some((interest: string) =>
                context.interests?.map(i => i.toLowerCase()).includes(interest.toLowerCase())
            );
            if (!hasCommonInterest) {
                return false;
            }
        }
        return true;
    }
}
