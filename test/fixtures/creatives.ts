/**
 * Test Fixtures - Creatives
 * Sample creative data for testing
 */

import { Status, CreativeType } from '../../src/shared/types';

export interface TestCreative {
  id: number;
  campaign_id: number;
  title: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  landing_url: string;
  creative_type: number;
  width: number;
  height: number;
  duration?: number;
  status: number;
  quality_score: number;
}

export const testCreatives: TestCreative[] = [
  {
    id: 1,
    campaign_id: 1,
    title: 'Test Banner 300x250',
    description: 'Standard banner ad',
    image_url: 'https://example.com/banner-300x250.jpg',
    landing_url: 'https://example.com/landing',
    creative_type: CreativeType.BANNER,
    width: 300,
    height: 250,
    status: Status.ACTIVE,
    quality_score: 85,
  },
  {
    id: 2,
    campaign_id: 1,
    title: 'Test Banner 728x90',
    description: 'Leaderboard banner ad',
    image_url: 'https://example.com/banner-728x90.jpg',
    landing_url: 'https://example.com/landing',
    creative_type: CreativeType.BANNER,
    width: 728,
    height: 90,
    status: Status.ACTIVE,
    quality_score: 80,
  },
  {
    id: 3,
    campaign_id: 2,
    title: 'Test Video 15s',
    description: '15 second video ad',
    video_url: 'https://example.com/video-15s.mp4',
    landing_url: 'https://example.com/landing',
    creative_type: CreativeType.VIDEO,
    width: 640,
    height: 360,
    duration: 15,
    status: Status.ACTIVE,
    quality_score: 90,
  },
  {
    id: 4,
    campaign_id: 3,
    title: 'Test Native Ad',
    description: 'Native advertising format',
    image_url: 'https://example.com/native.jpg',
    landing_url: 'https://example.com/landing',
    creative_type: CreativeType.NATIVE,
    width: 400,
    height: 300,
    status: Status.PAUSED,
    quality_score: 75,
  },
  {
    id: 5,
    campaign_id: 1,
    title: 'Test Banner 320x50',
    description: 'Mobile banner ad',
    image_url: 'https://example.com/banner-320x50.jpg',
    landing_url: 'https://example.com/landing',
    creative_type: CreativeType.BANNER,
    width: 320,
    height: 50,
    status: Status.ACTIVE,
    quality_score: 70,
  },
];

// Helper to create a creative
export function createTestCreative(overrides: Partial<TestCreative> = {}): TestCreative {
  return {
    id: Math.floor(Math.random() * 10000),
    campaign_id: 1,
    title: `Test Creative ${Date.now()}`,
    landing_url: 'https://example.com/landing',
    creative_type: CreativeType.BANNER,
    width: 300,
    height: 250,
    status: Status.ACTIVE,
    quality_score: 80,
    ...overrides,
  };
}

// Helper to get creatives by campaign
export function getCreativesByCampaign(campaignId: number): TestCreative[] {
  return testCreatives.filter(c => c.campaign_id === campaignId);
}

// Helper to get active creatives
export function getActiveCreatives(): TestCreative[] {
  return testCreatives.filter(c => c.status === Status.ACTIVE);
}
