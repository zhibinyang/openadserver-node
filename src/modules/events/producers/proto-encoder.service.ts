import { Injectable, Logger } from '@nestjs/common';
import * as protobuf from 'protobufjs';
import { join } from 'path';

import {
  EventType,
  SlotType,
  CreativeType,
  BidType,
  VideoEventType,
  RequestEvent,
  AdEvent,
  ImpressionEvent,
  ClickEvent,
  ConversionEvent,
  VideoVTREvent,
} from '../types/event.types';

@Injectable()
export class ProtoEncoderService {
  private readonly logger = new Logger(ProtoEncoderService.name);
  private root: protobuf.Root | null = null;
  private messageTypes: Map<EventType, protobuf.Type> = new Map();

  async onModuleInit(): Promise<void> {
    try {
      this.root = new protobuf.Root();

      // Load all proto files
      const schemaPath = join(__dirname, '../schemas');

      await this.loadProtoFile(join(schemaPath, 'request.proto'));
      await this.loadProtoFile(join(schemaPath, 'ad.proto'));
      await this.loadProtoFile(join(schemaPath, 'impression.proto'));
      await this.loadProtoFile(join(schemaPath, 'click.proto'));
      await this.loadProtoFile(join(schemaPath, 'conversion.proto'));
      await this.loadProtoFile(join(schemaPath, 'video_vtr.proto'));

      // Cache message types
      this.messageTypes.set(EventType.REQUEST, this.root.lookupType('events.RequestEvent'));
      this.messageTypes.set(EventType.AD, this.root.lookupType('events.AdEvent'));
      this.messageTypes.set(EventType.IMPRESSION, this.root.lookupType('events.ImpressionEvent'));
      this.messageTypes.set(EventType.CLICK, this.root.lookupType('events.ClickEvent'));
      this.messageTypes.set(EventType.CONVERSION, this.root.lookupType('events.ConversionEvent'));
      this.messageTypes.set(EventType.VIDEO_VTR, this.root.lookupType('events.VideoVTREvent'));

      this.logger.log('Protobuf schemas loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load protobuf schemas', error);
      throw error;
    }
  }

  private async loadProtoFile(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      protobuf.load(path, this.root!, (err, root) => {
        if (err) {
          reject(err);
        } else {
          if (root) {
            this.root = root;
          }
          resolve();
        }
      });
    });
  }

  /**
   * Encode a RequestEvent to protobuf
   */
  encodeRequest(event: RequestEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.REQUEST);
    if (!messageType) {
      throw new Error('RequestEvent type not loaded');
    }

    const payload = {
      request_id: event.requestId,
      event_time: event.eventTime,
      user_ids: event.userIds
        ? {
            user_id: event.userIds.userId,
            hashed_email: event.userIds.hashedEmail,
            hashed_phone: event.userIds.hashedPhone,
            device_id: event.userIds.deviceId,
            cookiesync_id: event.userIds.cookiesyncId,
            extended_ids: event.userIds.extendedIds,
          }
        : undefined,
      segments: event.segments,
      slot_id: event.slotId,
      slot_type: event.slotType,
      ip: event.ip,
      country: event.country,
      city: event.city,
      device: event.device,
      browser: event.browser,
      os: event.os,
      referer: event.referer,
      page_context: event.pageContext,
      response_count: event.responseCount,
      has_winner: event.hasWinner,
      winning_bid: event.winningBid,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`RequestEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode an AdEvent to protobuf
   */
  encodeAd(event: AdEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.AD);
    if (!messageType) {
      throw new Error('AdEvent type not loaded');
    }

    const payload = {
      request_id: event.requestId,
      impression_id: event.impressionId,
      click_id: event.clickId,
      campaign_id: event.campaignId,
      creative_id: event.creativeId,
      advertiser_id: event.advertiserId,
      event_time: event.eventTime,
      bid: event.bid,
      ecpm: event.ecpm,
      cost: event.cost,
      bid_type: event.bidType,
      creative_type: event.creativeType,
      banner_width: event.bannerWidth,
      banner_height: event.bannerHeight,
      video_duration: event.videoDuration,
      slot_id: event.slotId,
      pctr: event.pctr,
      pcvr: event.pcvr,
      landing_url: event.landingUrl,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`AdEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode an ImpressionEvent to protobuf
   */
  encodeImpression(event: ImpressionEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.IMPRESSION);
    if (!messageType) {
      throw new Error('ImpressionEvent type not loaded');
    }

    const payload = {
      click_id: event.clickId,
      event_time: event.eventTime,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`ImpressionEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode a ClickEvent to protobuf
   */
  encodeClick(event: ClickEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.CLICK);
    if (!messageType) {
      throw new Error('ClickEvent type not loaded');
    }

    const payload = {
      click_id: event.clickId,
      event_time: event.eventTime,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`ClickEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode a ConversionEvent to protobuf
   */
  encodeConversion(event: ConversionEvent): Buffer {
    const messageType = this.messageTypes.get(EventType.CONVERSION);
    if (!messageType) {
      throw new Error('ConversionEvent type not loaded');
    }

    const payload = {
      click_id: event.clickId,
      event_time: event.eventTime,
      conversion_value: event.conversionValue,
      conversion_type: event.conversionType,
      attributes: event.attributes,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`ConversionEvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode a VideoVTREvent to protobuf
   */
  encodeVideoVTR(event: VideoVTREvent): Buffer {
    const messageType = this.messageTypes.get(EventType.VIDEO_VTR);
    if (!messageType) {
      throw new Error('VideoVTREvent type not loaded');
    }

    const payload = {
      click_id: event.clickId,
      event_time: event.eventTime,
      event_type: event.eventType,
      progress_percent: event.progressPercent,
    };

    const err = messageType.verify(payload);
    if (err) {
      throw new Error(`VideoVTREvent verification failed: ${err}`);
    }

    const message = messageType.create(payload);
    return Buffer.from(messageType.encode(message).finish());
  }

  /**
   * Encode any event based on type
   */
  encode(eventType: EventType, event: unknown): Buffer {
    switch (eventType) {
      case EventType.REQUEST:
        return this.encodeRequest(event as RequestEvent);
      case EventType.AD:
        return this.encodeAd(event as AdEvent);
      case EventType.IMPRESSION:
        return this.encodeImpression(event as ImpressionEvent);
      case EventType.CLICK:
        return this.encodeClick(event as ClickEvent);
      case EventType.CONVERSION:
        return this.encodeConversion(event as ConversionEvent);
      case EventType.VIDEO_VTR:
        return this.encodeVideoVTR(event as VideoVTREvent);
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }
}
