/**
 * Test Fixtures - Campaigns
 * Sample campaign data for testing
 */

import { Status, BidType, PacingType } from '../../src/shared/types';

export interface TestCampaign {
  id: number;
  advertiser_id: number;
  name: string;
  description?: string;
  budget_daily: string;
  budget_total: string;
  spent_today: string;
  spent_total: string;
  bid_type: number;
  bid_amount: string;
  pacing_type: number;
  freq_cap_daily: number;
  freq_cap_hourly: number;
  start_time?: Date;
  end_time?: Date;
  status: number;
  is_active: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
}

export const testCampaigns: TestCampaign[] = [
  {
    id: 1,
    advertiser_id: 1,
    name: 'Test Campaign 1 - Active CPM',
    description: 'Active CPM campaign for testing',
    budget_daily: '100.00',
    budget_total: '1000.00',
    spent_today: '10.00',
    spent_total: '100.00',
    bid_type: BidType.CPM,
    bid_amount: '1.50',
    pacing_type: PacingType.EVEN,
    freq_cap_daily: 10,
    freq_cap_hourly: 3,
    status: Status.ACTIVE,
    is_active: true,
    impressions: 10000,
    clicks: 200,
    conversions: 10,
  },
  {
    id: 2,
    advertiser_id: 1,
    name: 'Test Campaign 2 - Active CPC',
    description: 'Active CPC campaign for testing',
    budget_daily: '200.00',
    budget_total: '2000.00',
    spent_today: '20.00',
    spent_total: '200.00',
    bid_type: BidType.CPC,
    bid_amount: '0.50',
    pacing_type: PacingType.ACCELERATED,
    freq_cap_daily: 5,
    freq_cap_hourly: 2,
    status: Status.ACTIVE,
    is_active: true,
    impressions: 5000,
    clicks: 100,
    conversions: 5,
  },
  {
    id: 3,
    advertiser_id: 2,
    name: 'Test Campaign 3 - Paused',
    description: 'Paused campaign for testing',
    budget_daily: '50.00',
    budget_total: '500.00',
    spent_today: '0.00',
    spent_total: '50.00',
    bid_type: BidType.CPM,
    bid_amount: '2.00',
    pacing_type: PacingType.EVEN,
    freq_cap_daily: 10,
    freq_cap_hourly: 3,
    status: Status.PAUSED,
    is_active: false,
    impressions: 1000,
    clicks: 20,
    conversions: 1,
  },
  {
    id: 4,
    advertiser_id: 1,
    name: 'Test Campaign 4 - Budget Exhausted',
    description: 'Campaign with exhausted daily budget',
    budget_daily: '100.00',
    budget_total: '1000.00',
    spent_today: '100.00', // Exhausted
    spent_total: '500.00',
    bid_type: BidType.CPM,
    bid_amount: '1.00',
    pacing_type: PacingType.EVEN,
    freq_cap_daily: 10,
    freq_cap_hourly: 3,
    status: Status.ACTIVE,
    is_active: true,
    impressions: 100000,
    clicks: 2000,
    conversions: 100,
  },
  {
    id: 5,
    advertiser_id: 1,
    name: 'Test Campaign 5 - Future Schedule',
    description: 'Campaign scheduled for future',
    budget_daily: '100.00',
    budget_total: '1000.00',
    spent_today: '0.00',
    spent_total: '0.00',
    bid_type: BidType.CPM,
    bid_amount: '1.00',
    pacing_type: PacingType.EVEN,
    freq_cap_daily: 10,
    freq_cap_hourly: 3,
    start_time: new Date('2099-01-01'),
    end_time: new Date('2099-12-31'),
    status: Status.ACTIVE,
    is_active: true,
    impressions: 0,
    clicks: 0,
    conversions: 0,
  },
];

// Helper to create a campaign
export function createTestCampaign(overrides: Partial<TestCampaign> = {}): TestCampaign {
  return {
    id: Math.floor(Math.random() * 10000),
    advertiser_id: 1,
    name: `Test Campaign ${Date.now()}`,
    budget_daily: '100.00',
    budget_total: '1000.00',
    spent_today: '0.00',
    spent_total: '0.00',
    bid_type: BidType.CPM,
    bid_amount: '1.00',
    pacing_type: PacingType.EVEN,
    freq_cap_daily: 10,
    freq_cap_hourly: 3,
    status: Status.ACTIVE,
    is_active: true,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ...overrides,
  };
}

// Helper to get active campaigns only
export function getActiveCampaigns(): TestCampaign[] {
  return testCampaigns.filter(c => c.status === Status.ACTIVE && c.is_active);
}
