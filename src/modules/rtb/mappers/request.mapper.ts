import { Injectable, Logger } from '@nestjs/common';
import { UserContext, CreativeType } from '../../../shared/types';
import {
  OpenRtbBidRequest,
  OpenRtbImp,
  OpenRtbBanner,
  OpenRtbVideo,
  OpenRtbDevice,
  OpenRtbUser,
  OpenRtbSite,
  OpenRtbApp,
} from '../dto/bid-request.dto';

/**
 * Mapping result for a single impression
 */
export interface ImpressionContext {
  impId: string;
  slotId: string;
  slotType: CreativeType;
  slotWidth?: number;
  slotHeight?: number;
  bidFloor: number;
  bidFloorCur: string;
  secure: boolean;
  instl: boolean;
  videoDuration?: number;
  videoPlacement?: number;
}

/**
 * Full context extracted from a BidRequest
 */
export interface RtbContext {
  requestId: string;
  userContext: UserContext;
  impressions: ImpressionContext[];
  site?: OpenRtbSite;
  app?: OpenRtbApp;
  blockedCategories: string[];
  blockedAdvertisers: string[];
  blockedApps: string[];
  tmax?: number;
  cur: string[];
  test: boolean;
}

@Injectable()
export class RequestMapper {
  private readonly logger = new Logger(RequestMapper.name);

  /**
   * Map OpenRTB BidRequest to internal RtbContext
   */
  map(bidRequest: OpenRtbBidRequest): RtbContext {
    const userContext = this.mapUserContext(bidRequest);
    const impressions = this.mapImpressions(bidRequest.imp);

    const result: RtbContext = {
      requestId: bidRequest.id,
      userContext,
      impressions,
      site: bidRequest.site,
      app: bidRequest.app,
      blockedCategories: bidRequest.bcat || [],
      blockedAdvertisers: bidRequest.badv || [],
      blockedApps: bidRequest.bapp || [],
      tmax: bidRequest.tmax,
      cur: bidRequest.cur || ['USD'],
      test: bidRequest.test === 1,
    };

    this.logger.debug(
      `Mapped BidRequest ${bidRequest.id}: ${impressions.length} impressions, ` +
      `user=${userContext.user_id || 'anonymous'}, country=${userContext.country || 'unknown'}`
    );

    return result;
  }

  /**
   * Map device and user info to UserContext
   */
  private mapUserContext(bidRequest: OpenRtbBidRequest): UserContext {
    const device = bidRequest.device;
    const user = bidRequest.user;
    const site = bidRequest.site;
    const app = bidRequest.app;

    // Extract geo from device or user
    const geo = device?.geo || user?.geo;

    // Parse user interests from keywords
    const interests = this.parseInterests(user?.keywords);

    // Parse age from year of birth
    const age = user?.yob ? new Date().getFullYear() - user.yob : undefined;

    // Normalize gender
    const gender = this.normalizeGender(user?.gender);

    // Determine OS
    const os = this.normalizeOs(device?.os);

    // Build context
    const context: UserContext = {
      user_id: user?.id || user?.buyeruid || '',
      ip: device?.ip || device?.ipv6 || '',
      os: os,
      os_version: device?.osv,
      device: device?.model ? `${device.make || ''} ${device.model}`.trim() : undefined,
      browser: undefined, // Will be extracted from UA if needed
      device_brand: device?.make,
      country: geo?.country,
      region: geo?.region,
      city: geo?.city,
      latitude: geo?.lat,
      longitude: geo?.lon,
      app_id: app?.id || app?.bundle || 'unknown',
      app_name: app?.name,
      carrier: device?.carrier,
      age: age,
      gender: gender,
      interests: interests,
      referer: site?.page || site?.ref,
      page_context: site?.keywords || app?.keywords,
      num_ads: 1,
    };

    return context;
  }

  /**
   * Map impressions to internal format
   */
  private mapImpressions(imps: OpenRtbImp[]): ImpressionContext[] {
    return imps.map(imp => this.mapImpression(imp));
  }

  /**
   * Map a single impression
   */
  private mapImpression(imp: OpenRtbImp): ImpressionContext {
    const { slotType, width, height, videoDuration, videoPlacement } = this.detectCreativeType(imp);

    return {
      impId: imp.id,
      slotId: imp.tagid || `imp_${imp.id}`,
      slotType,
      slotWidth: width,
      slotHeight: height,
      bidFloor: imp.bidfloor || 0,
      bidFloorCur: imp.bidfloorcur || 'USD',
      secure: imp.secure === 1,
      instl: imp.instl === 1,
      videoDuration,
      videoPlacement,
    };
  }

  /**
   * Detect creative type and dimensions from impression
   */
  private detectCreativeType(imp: OpenRtbImp): {
    slotType: CreativeType;
    width?: number;
    height?: number;
    videoDuration?: number;
    videoPlacement?: number;
  } {
    // Banner
    if (imp.banner) {
      return {
        slotType: CreativeType.BANNER,
        width: imp.banner.w,
        height: imp.banner.h,
      };
    }

    // Video
    if (imp.video) {
      return {
        slotType: CreativeType.VIDEO,
        width: imp.video.w,
        height: imp.video.h,
        videoDuration: imp.video.maxduration,
        videoPlacement: imp.video.placement,
      };
    }

    // Native
    if (imp.native) {
      return {
        slotType: CreativeType.NATIVE,
      };
    }

    // Default to Banner if no specific type
    return {
      slotType: CreativeType.BANNER,
    };
  }

  /**
   * Parse interests from user keywords
   */
  private parseInterests(keywords?: string): string[] {
    if (!keywords) return [];
    return keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
  }

  /**
   * Normalize OS string
   */
  private normalizeOs(os?: string): string {
    if (!os) return 'unknown';

    const osLower = os.toLowerCase();

    if (osLower.includes('ios') || osLower.includes('iphone') || osLower.includes('ipad')) {
      return 'ios';
    }
    if (osLower.includes('android')) {
      return 'android';
    }
    if (osLower.includes('windows')) {
      return 'windows';
    }
    if (osLower.includes('mac') || osLower.includes('macos')) {
      return 'macos';
    }
    if (osLower.includes('linux')) {
      return 'linux';
    }

    return osLower;
  }

  /**
   * Normalize gender string
   */
  private normalizeGender(gender?: string): string | undefined {
    if (!gender) return undefined;

    const g = gender.toLowerCase();
    if (g === 'm' || g === 'male') return 'male';
    if (g === 'f' || g === 'female') return 'female';
    if (g === 'o' || g === 'other') return 'other';

    return 'unknown';
  }
}
