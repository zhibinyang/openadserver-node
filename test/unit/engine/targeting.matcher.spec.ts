/**
 * TargetingMatcher Unit Tests
 * Tests for the targeting rule matching logic
 */

import { TargetingMatcher } from '../../../src/modules/engine/services/targeting.matcher';
import { TargetingRuleType } from '../../../src/shared/types';
import { createUserContext } from '../../fixtures';

describe('TargetingMatcher', () => {
  let matcher: TargetingMatcher;

  beforeEach(() => {
    matcher = new TargetingMatcher();
  });

  describe('match', () => {
    it('should return true when no rules provided', async () => {
      const context = createUserContext();
      const result = await matcher.match([], context);
      expect(result).toBe(true);
    });

    it('should return true when rules array is undefined', async () => {
      const context = createUserContext();
      const result = await matcher.match(undefined as any, context);
      expect(result).toBe(true);
    });
  });

  describe('Geo Targeting', () => {
    it('should match when country is in include list', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { countries: ['US', 'CN', 'UK'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ country: 'US' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match when country is not in include list', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { countries: ['US', 'CN'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ country: 'JP' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });

    it('should match when country is in exclude list (excluded)', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { countries: ['US', 'CN'] },
          is_include: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ country: 'US' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });

    it('should match when country is not in exclude list', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { countries: ['US', 'CN'] },
          is_include: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ country: 'JP' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should match by city', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { cities: ['New York', 'Los Angeles'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ city: 'New York' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });
  });

  describe('Age Targeting', () => {
    it('should match age within range (object format)', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.AGE,
          rule_value: { min: 18, max: 34 },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ age: 25 });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match age outside range', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.AGE,
          rule_value: { min: 18, max: 34 },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ age: 40 });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });

    it('should match age range (string format)', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.AGE,
          rule_value: '20-30',
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ age: 25 });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match when age is not provided', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.AGE,
          rule_value: { min: 18, max: 34 },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext();
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });
  });

  describe('Gender Targeting', () => {
    it('should match gender', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GENDER,
          rule_value: 'male',
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ gender: 'male' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should match multiple genders', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GENDER,
          rule_value: ['male', 'female'],
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ gender: 'female' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match different gender', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GENDER,
          rule_value: 'female',
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ gender: 'male' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });
  });

  describe('Device Targeting', () => {
    it('should match OS', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.DEVICE,
          rule_value: { os: ['ios', 'android'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ os: 'ios' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should match browser', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.DEVICE,
          rule_value: { browser: ['chrome', 'firefox'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ browser: 'chrome' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match when OS not in list', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.DEVICE,
          rule_value: { os: ['ios'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ os: 'android' });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });
  });

  describe('Interest Targeting', () => {
    it('should match when user has required interest', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.INTEREST_INCLUDE,
          rule_value: { values: ['tech', 'sports'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ interests: ['tech', 'gaming'] });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match when user lacks required interest', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.INTEREST_INCLUDE,
          rule_value: { values: ['tech', 'sports'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ interests: ['fashion', 'beauty'] });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });

    it('should exclude users with specific interests', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.INTEREST_EXCLUDE,
          rule_value: { values: ['gaming'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ interests: ['tech', 'gaming'] });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });
  });

  describe('Multiple Rules (AND logic)', () => {
    it('should match when all rules pass', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { countries: ['US'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          campaign_id: 1,
          rule_type: TargetingRuleType.AGE,
          rule_value: { min: 18, max: 34 },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ country: 'US', age: 25 });
      const result = await matcher.match(rules, context);
      expect(result).toBe(true);
    });

    it('should not match when any rule fails', async () => {
      const rules = [
        {
          id: 1,
          campaign_id: 1,
          rule_type: TargetingRuleType.GEO,
          rule_value: { countries: ['US'] },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          campaign_id: 1,
          rule_type: TargetingRuleType.AGE,
          rule_value: { min: 18, max: 34 },
          is_include: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const context = createUserContext({ country: 'US', age: 40 });
      const result = await matcher.match(rules, context);
      expect(result).toBe(false);
    });
  });
});
