
import { Injectable } from '@nestjs/common';
import { AdCandidate } from '../../../shared/types';

export interface VastTrackingEvents {
    impression: string;
    clickThrough: string;
    clickTracking: string;
    start: string;
    firstQuartile: string;
    midpoint: string;
    thirdQuartile: string;
    complete: string;
}

@Injectable()
export class VastBuilder {
    /**
     * Builds a VAST 3.0 XML response for a single ad candidate.
     */
    build(candidate: AdCandidate, tracking: VastTrackingEvents, requestId: string): string {
        // Escape special characters in strings to be XML safe
        const title = this.escapeXml(candidate.title || 'Video Ad');
        const description = this.escapeXml(candidate.description || '');
        const duration = this.formatDuration(candidate.metadata?.duration || 15); // Default 15s if missing

        return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
  <Ad id="${candidate.campaign_id}">
    <InLine>
      <AdSystem>OpenAdServer</AdSystem>
      <AdTitle>${title}</AdTitle>
      <Description>${description}</Description>
      <Error><![CDATA[]]></Error>
      <Impression><![CDATA[${tracking.impression}]]></Impression>
      <Creatives>
        <Creative id="${candidate.creative_id}" sequence="1">
          <Linear>
            <Duration>${duration}</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[${tracking.start}]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[${tracking.firstQuartile}]]></Tracking>
              <Tracking event="midpoint"><![CDATA[${tracking.midpoint}]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[${tracking.thirdQuartile}]]></Tracking>
              <Tracking event="complete"><![CDATA[${tracking.complete}]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[${tracking.clickThrough}]]></ClickThrough>
              <ClickTracking><![CDATA[${tracking.clickTracking}]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="${candidate.width || 640}" height="${candidate.height || 360}" scalable="true" maintainAspectRatio="true">
                <![CDATA[${candidate.video_url || candidate.image_url || ''}]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
    }

    /**
     * Helper to return an empty VAST response (No Ad).
     */
    buildEmpty(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0">
</VAST>`;
    }

    private escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    private formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
}
