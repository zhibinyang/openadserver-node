/**
 * Test Fixtures - Bid Requests
 * Sample OpenRTB 2.6 bid request data for testing
 */

export interface TestBidRequest {
  id: string;
  imp: any[];
  site?: any;
  app?: any;
  device?: any;
  user?: any;
  test?: number;
}

export const testBidRequests: TestBidRequest[] = [
  // Standard banner request
  {
    id: 'bid-req-001',
    imp: [
      {
        id: 'imp-001',
        banner: {
          w: 300,
          h: 250,
          format: [{ w: 300, h: 250 }],
        },
        bidfloor: 0.5,
        bidfloorcur: 'USD',
      },
    ],
    site: {
      id: 'site-001',
      domain: 'example.com',
      page: 'https://example.com/page',
    },
    device: {
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      ip: '8.8.8.8',
      devicetype: 4, // Mobile
      os: 'iOS',
      osv: '14.0',
    },
    user: {
      id: 'user-001',
      yob: 1995,
      gender: 'M',
    },
  },
  // Video request
  {
    id: 'bid-req-002',
    imp: [
      {
        id: 'imp-001',
        video: {
          mimes: ['video/mp4'],
          minduration: 5,
          maxduration: 30,
          w: 640,
          h: 360,
          linearity: 1,
        },
        bidfloor: 5.0,
        bidfloorcur: 'USD',
      },
    ],
    site: {
      id: 'site-002',
      domain: 'video.example.com',
      page: 'https://video.example.com/watch',
    },
    device: {
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ip: '1.1.1.1',
      devicetype: 2, // Desktop
      os: 'Windows',
    },
    user: {
      id: 'user-002',
    },
  },
  // Multi-impression request
  {
    id: 'bid-req-003',
    imp: [
      {
        id: 'imp-001',
        banner: { w: 728, h: 90 },
        bidfloor: 1.0,
      },
      {
        id: 'imp-002',
        banner: { w: 300, h: 250 },
        bidfloor: 0.5,
      },
      {
        id: 'imp-003',
        banner: { w: 160, h: 600 },
        bidfloor: 0.8,
      },
    ],
    site: {
      id: 'site-003',
      domain: 'news.example.com',
      page: 'https://news.example.com/article',
    },
    device: {
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '114.114.114.114',
      devicetype: 2,
      os: 'macOS',
    },
    user: {
      id: 'user-003',
      yob: 1985,
      gender: 'F',
    },
  },
  // Native request
  {
    id: 'bid-req-004',
    imp: [
      {
        id: 'imp-001',
        native: {
          request: JSON.stringify({
            assets: [
              { id: 1, title: { len: 25 } },
              { id: 2, img: { w: 300, h: 200 } },
              { id: 3, data: { type: 2 } }, // Description
            ],
          }),
        },
        bidfloor: 0.3,
      },
    ],
    app: {
      id: 'app-001',
      name: 'Test App',
      bundle: 'com.example.app',
    },
    device: {
      ua: 'Mozilla/5.0 (Linux; Android 11)',
      ip: '8.8.4.4',
      devicetype: 4,
      os: 'Android',
    },
    user: {
      id: 'user-004',
    },
  },
];

// Helper to create a bid request
export function createBidRequest(overrides: Partial<TestBidRequest> = {}): TestBidRequest {
  return {
    id: `bid-req-${Date.now()}`,
    imp: [
      {
        id: 'imp-001',
        banner: { w: 300, h: 250 },
        bidfloor: 0.5,
        bidfloorcur: 'USD',
      },
    ],
    site: {
      id: 'site-test',
      domain: 'test.com',
      page: 'https://test.com/page',
    },
    device: {
      ua: 'Mozilla/5.0',
      ip: '127.0.0.1',
    },
    user: {
      id: 'test-user',
    },
    ...overrides,
  };
}

// Helper to create OpenRTB bid request format
export function createOpenRtbBidRequest(overrides: any = {}): any {
  return {
    id: `req-${Date.now()}`,
    imp: [
      {
        id: 'imp1',
        banner: { w: 300, h: 250 },
      },
    ],
    site: { domain: 'example.com' },
    device: { ip: '127.0.0.1', ua: 'test' },
    ...overrides,
  };
}
