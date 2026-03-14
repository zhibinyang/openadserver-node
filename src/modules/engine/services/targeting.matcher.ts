
import { Injectable, Optional } from '@nestjs/common';
import { UserContext, TargetingRuleType } from '../../../shared/types';
import { CachedRule } from './cache.service';
import { SegmentService } from './segment.service';

@Injectable()
export class TargetingMatcher {
    constructor(@Optional() private segmentService?: SegmentService) { }

    /**
     * Check if user context matches a list of rules.
     * Logic: Rules are ANDed together (must pass all).
     * Inside a rule, values are usually ORed (e.g. "US" or "CA").
     */
    async match(rules: CachedRule[], context: UserContext): Promise<boolean> {
        if (!rules || rules.length === 0) return true;

        for (const rule of rules) {
            if (!await this.matchSingleRule(rule, context)) {
                return false;
            }
        }
        return true;
    }

    private async matchSingleRule(rule: CachedRule, context: UserContext): Promise<boolean> {
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
            case 'interest':
                // Old interest rule format
                matched = this.matchInterests(value, context);
                break;
            case TargetingRuleType.SEGMENT_INCLUDE:
                matched = this.segmentService ? await this.matchSegments(value, context) : false;
                break;
            case TargetingRuleType.SEGMENT_EXCLUDE:
                matched = this.segmentService ? !await this.matchSegments(value, context) : true;
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
     * Supported formats: object {min: 18, max: 34} or string "20-30", "18-", "-40"
     */
    private matchAge(ageRule: any, context: UserContext): boolean {
        if (!context.age) return false; // No age info, can't match

        const userAge = context.age;
        if (isNaN(userAge) || userAge < 0 || userAge > 120) return false;

        // Object format: {min: 18, max: 34}
        if (typeof ageRule === 'object' && ageRule !== null) {
            const min = ageRule.min ?? 0;
            const max = ageRule.max ?? 120;
            return userAge >= min && userAge <= max;
        }

        // String format: "20-30", "18-", "-40"
        if (typeof ageRule === 'string') {
            if (ageRule.includes('-')) {
                const [minStr, maxStr] = ageRule.split('-', 2);
                const min = minStr ? parseInt(minStr, 10) : 0;
                const max = maxStr ? parseInt(maxStr, 10) : 120;
                return !isNaN(min) && !isNaN(max) && userAge >= min && userAge <= max;
            }
            // Single age value
            const age = parseInt(ageRule, 10);
            return !isNaN(age) && userAge === age;
        }

        return false; // Invalid age rule format
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
    private matchInterests(ruleValue: any, context: UserContext): boolean {
        if (!context.interests || context.interests.length === 0) return false;
        const interests = ruleValue?.values || ruleValue;
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

    /**
     * Match segment rule: user belongs to at least one of the specified segments.
     */
    private async matchSegments(segmentIds: any, context: UserContext): Promise<boolean> {
        if (!context.user_id) return false; // No user id, can't match
        if (!segmentIds) return false;
        if (!this.segmentService) return false; // Segment service not available

        const targetSegments = Array.isArray(segmentIds) ? segmentIds : [segmentIds];
        if (targetSegments.length === 0) return false;

        const userSegments = await this.segmentService.getUserSegmentIds(context.user_id);
        return targetSegments.some(segId => userSegments.includes(Number(segId)));
    }
}
