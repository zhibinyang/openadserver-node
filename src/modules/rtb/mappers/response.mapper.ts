import { Injectable, Logger } from '@nestjs/common';
import { AdCandidate, CreativeType, BidType } from '../../../shared/types';
import {
  OpenRtbBidResponse,
  OpenRtbSeatBid,
  OpenRtbBid,
  OpenRtbNoBidReason,
} from '../dto/bid-request.dto';
import { ImpressionContext } from './request.mapper';
import { randomUUID } from 'crypto';

/**
 * Response mapper: AdCandidate -> OpenRTB BidResponse
 */
@Injectable()
export class ResponseMapper {
  private readonly logger = new Logger(ResponseMapper.name);

  /**
   * Build a BidResponse from ad candidates
   */
  map(
    requestId: string,
    candidates: AdCandidate[],
    impressions: ImpressionContext[],
    currency: string = 'USD',
  ): OpenRtbBidResponse | null {
    if (candidates.length === 0) {
      return null;
    }

    // Map candidates to bids
    const bids = candidates.map((candidate, index) => {
      const imp = impressions[index] || impressions[0];
      return this.mapCandidateToBid(candidate, imp);
    });

    // Group bids into seatbid
    const seatbid: OpenRtbSeatBid[] = [{
      bid: bids,
      seat: 'openadserver', // Our bidder seat ID
      group: 0,
    }];

    const response: OpenRtbBidResponse = {
      id: requestId,
      seatbid,
      bidid: randomUUID(),
      cur: currency,
    };

    this.logger.debug(
      `Built BidResponse for request ${requestId}: ${bids.length} bids`
    );

    return response;
  }

  /**
   * Build a no-bid response
   */
  mapNoBid(
    requestId: string,
    reason?: OpenRtbNoBidReason,
  ): OpenRtbBidResponse {
    const response: OpenRtbBidResponse = {
      id: requestId,
      nbr: reason || OpenRtbNoBidReason.UNKNOWN_ERROR,
    };

    this.logger.debug(
      `Built No-Bid response for request ${requestId}, reason: ${reason || 'unknown'}`
    );

    return response;
  }

  /**
   * Map a single AdCandidate to OpenRTB Bid
   */
  private mapCandidateToBid(
    candidate: AdCandidate,
    imp: ImpressionContext,
  ): OpenRtbBid {
    const bidId = `bid_${candidate.campaign_id}_${candidate.creative_id}_${randomUUID().slice(0, 8)}`;

    // Price is the actual cost (GSP) or bid amount
    const price = candidate.actual_cost ?? candidate.bid;

    // Build ad markup based on creative type
    const adm = this.buildAdMarkup(candidate);

    // Win notice URL
    const nurl = this.buildWinNoticeUrl(candidate, price);

    const bid: OpenRtbBid = {
      id: bidId,
      impid: imp.impId,
      price: price,
      adid: `${candidate.campaign_id}`,
      nurl: nurl,
      adm: adm,
      adomain: this.extractDomain(candidate.landing_url),
      cid: `${candidate.campaign_id}`,
      crid: `${candidate.creative_id}`,
      w: candidate.width || imp.slotWidth,
      h: candidate.height || imp.slotHeight,
    };

    return bid;
  }

  /**
   * Build ad markup based on creative type
   */
  private buildAdMarkup(candidate: AdCandidate): string {
    switch (candidate.creative_type) {
      case CreativeType.BANNER:
        return this.buildBannerAdm(candidate);
      case CreativeType.VIDEO:
        return this.buildVideoAdm(candidate);
      case CreativeType.NATIVE:
        return this.buildNativeAdm(candidate);
      default:
        return this.buildBannerAdm(candidate);
    }
  }

  /**
   * Build banner ad markup
   */
  private buildBannerAdm(candidate: AdCandidate): string {
    // Simple HTML banner
    const clickUrl = candidate.landing_url;
    const imageUrl = candidate.image_url || '';

    return `<a href="${clickUrl}" target="_blank">
  <img src="${imageUrl}" alt="${candidate.title || 'Ad'}" width="${candidate.width || 300}" height="${candidate.height || 250}" border="0" />
</a>`;
  }

  /**
   * Build video ad markup (VAST)
   */
  private buildVideoAdm(candidate: AdCandidate): string {
    const clickUrl = candidate.landing_url;
    const videoUrl = candidate.video_url || '';
    const duration = candidate.duration || 30;

    return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="${candidate.campaign_id}">
    <InLine>
      <AdSystem>OpenAdServer</AdSystem>
      <AdTitle>${candidate.title || 'Video Ad'}</AdTitle>
      <Impression><![CDATA[${clickUrl}]]></Impression>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>00:00:${duration.toString().padStart(2, '0')}</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="${candidate.width || 640}" height="${candidate.height || 480}">
                <![CDATA[${videoUrl}]]>
              </MediaFile>
            </MediaFiles>
            <ClickThrough><![CDATA[${clickUrl}]]></ClickThrough>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
  }

  /**
   * Build native ad markup
   */
  private buildNativeAdm(candidate: AdCandidate): string {
    // OpenRTB Native 1.2 format
    const native = {
      native: {
        ver: '1.2',
        assets: [
          {
            id: 1,
            title: {
              text: candidate.title || '',
            },
          },
          {
            id: 2,
            data: {
              value: candidate.description || '',
            },
          },
          {
            id: 3,
            img: {
              url: candidate.image_url || '',
              w: candidate.width || 300,
              h: candidate.height || 250,
            },
          },
        ],
        link: {
          url: candidate.landing_url,
        },
      },
    };

    return JSON.stringify(native);
  }

  /**
   * Build win notice URL
   */
  private buildWinNoticeUrl(candidate: AdCandidate, price: number): string {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/rtb/win?campaign_id=${candidate.campaign_id}&creative_id=${candidate.creative_id}&price=${price}&bid_id=\${AUCTION_BID_ID}&imp_id=\${AUCTION_IMP_ID}`;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string[] {
    try {
      const parsed = new URL(url);
      return [parsed.hostname];
    } catch {
      return [];
    }
  }
}
