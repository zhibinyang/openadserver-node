/**
 * Test Fixtures - User Contexts
 * Sample user context data for testing targeting
 */

import { UserContext } from '../../src/shared/types';

export const testUserContexts: UserContext[] = [
  // US user with interests
  {
    user_id: 'user-001',
    ip: '8.8.8.8',
    country: 'US',
    city: 'New York',
    device: 'iPhone',
    browser: 'chrome',
    os: 'ios',
    age: 28,
    gender: 'male',
    interests: ['tech', 'sports', 'gaming'],
  },
  // CN user
  {
    user_id: 'user-002',
    ip: '114.114.114.114',
    country: 'CN',
    city: 'Beijing',
    device: 'Android',
    browser: 'chrome',
    os: 'android',
    age: 35,
    gender: 'female',
    interests: ['shopping', 'travel'],
  },
  // AU user
  {
    user_id: 'user-003',
    ip: '1.1.1.1',
    country: 'AU',
    city: 'Sydney',
    device: 'Desktop',
    browser: 'firefox',
    os: 'windows',
    age: 45,
    gender: 'male',
    interests: ['finance', 'news'],
  },
  // User without profile
  {
    user_id: 'user-004',
    ip: '192.168.1.1',
    country: 'US',
    city: 'Unknown',
    device: 'Desktop',
    browser: 'safari',
    os: 'macos',
  },
  // Mobile user
  {
    user_id: 'user-005',
    ip: '8.8.4.4',
    country: 'US',
    city: 'Los Angeles',
    device: 'Samsung Galaxy',
    browser: 'chrome',
    os: 'android',
    age: 22,
    gender: 'female',
    interests: ['fashion', 'beauty', 'social'],
  },
];

// Helper to create a user context
export function createUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    user_id: `user-${Date.now()}`,
    ip: '127.0.0.1',
    country: 'US',
    city: 'Test City',
    device: 'Desktop',
    browser: 'chrome',
    os: 'windows',
    ...overrides,
  };
}

// Helper to get user by country
export function getUsersByCountry(country: string): UserContext[] {
  return testUserContexts.filter(u => u.country === country);
}

// Helper to get user by interest
export function getUsersByInterest(interest: string): UserContext[] {
  return testUserContexts.filter(u => u.interests?.includes(interest));
}
