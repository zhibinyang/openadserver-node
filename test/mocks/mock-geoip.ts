/**
 * Mock GeoIP for Testing
 * Simulates MaxMind GeoIP lookups
 */

export interface MockGeoResult {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

// Default geo data for common IPs
const DEFAULT_GEO_DATA: Record<string, MockGeoResult> = {
  '8.8.8.8': { country: 'US', city: 'Mountain View', latitude: 37.386, longitude: -122.0838 },
  '1.1.1.1': { country: 'AU', city: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
  '114.114.114.114': { country: 'CN', city: 'Nanjing', latitude: 32.0603, longitude: 118.7969 },
};

export class MockGeoIpReader {
  private geoData: Record<string, MockGeoResult>;
  private defaultResult: MockGeoResult;

  constructor(geoData: Record<string, MockGeoResult> = {}) {
    this.geoData = { ...DEFAULT_GEO_DATA, ...geoData };
    this.defaultResult = { country: 'US', city: 'Unknown' };
  }

  get(ip: string): MockGeoResult | null {
    // Handle localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return this.defaultResult;
    }

    return this.geoData[ip] || this.defaultResult;
  }

  // Configure geo data for specific IP
  setGeoData(ip: string, result: MockGeoResult): void {
    this.geoData[ip] = result;
  }

  // Set default result for unknown IPs
  setDefaultResult(result: MockGeoResult): void {
    this.defaultResult = result;
  }

  // Clear custom geo data
  clear(): void {
    this.geoData = { ...DEFAULT_GEO_DATA };
  }
}

// Singleton instance
export const mockGeoIpReader = new MockGeoIpReader();

// Mock MaxMind module
export const mockMaxmind = {
  open: jest.fn().mockResolvedValue(mockGeoIpReader),
  Reader: MockGeoIpReader,
};

// Helper to create geo service mock
export function createMockGeoService() {
  return {
    lookup: jest.fn().mockResolvedValue({ country: 'US', city: 'New York' }),
    getCountry: jest.fn().mockResolvedValue('US'),
    getCity: jest.fn().mockResolvedValue('New York'),
  };
}
