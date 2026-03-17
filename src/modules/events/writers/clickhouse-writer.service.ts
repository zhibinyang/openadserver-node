import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';

import { EventType, AnyEvent } from '../types/event.types';
import { ProtoDecoderService } from '../producers/proto-decoder.service';

interface BatchItem {
  eventType: EventType;
  event: AnyEvent;
}

@Injectable()
export class ClickHouseWriterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseWriterService.name);
  private client: ClickHouseClient | null = null;
  private readonly database: string;
  private readonly tableNamePrefix: string;

  // Batch buffer for efficient writes
  private batchBuffer: Map<EventType, AnyEvent[]> = new Map();
  private readonly batchSize: number;
  private readonly batchTimeoutMs: number;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly protoDecoder: ProtoDecoderService,
  ) {
    this.database = this.configService.get<string>('CLICKHOUSE_DATABASE', 'default');
    this.tableNamePrefix = this.configService.get<string>('CLICKHOUSE_TABLE_PREFIX', '');
    this.batchSize = this.configService.get<number>('CLICKHOUSE_BATCH_SIZE', 1000);
    this.batchTimeoutMs = this.configService.get<number>('CLICKHOUSE_BATCH_TIMEOUT_MS', 5000);

    // Initialize batch buffer for each event type
    Object.values(EventType).forEach((type) => {
      if (typeof type === 'string') {
        this.batchBuffer.set(type as EventType, []);
      }
    });
  }

  async onModuleInit(): Promise<void> {
    const clickhouseEnabled = this.configService.get<string>('CLICKHOUSE_ENABLED', 'false') === 'true';

    if (!clickhouseEnabled) {
      this.logger.log('ClickHouse writer disabled');
      return;
    }

    try {
      const host = this.configService.get<string>('CLICKHOUSE_HOST', 'http://localhost:8123');
      const username = this.configService.get<string>('CLICKHOUSE_USER', 'default');
      const password = this.configService.get<string>('CLICKHOUSE_PASSWORD', '');

      this.client = createClient({
        host,
        username,
        password,
        database: this.database,
      });

      // Test connection
      await this.client.ping();
      this.logger.log(`ClickHouse connected to ${host}`);

      // Start batch timer
      this.startBatchTimer();
    } catch (error) {
      this.logger.error('Failed to connect to ClickHouse', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Flush remaining events
    await this.flushAllBatches();

    if (this.client) {
      await this.client.close();
      this.logger.log('ClickHouse connection closed');
    }
  }

  /**
   * Write an event to ClickHouse (adds to batch buffer)
   */
  async write(eventType: EventType, data: Buffer): Promise<void> {
    if (!this.client) {
      this.logger.warn('ClickHouse not connected, skipping write');
      return;
    }

    try {
      // Decode protobuf
      const event = this.protoDecoder.decode(eventType, data);

      // Add to batch buffer
      const buffer = this.batchBuffer.get(eventType);
      if (buffer) {
        buffer.push(event);

        // Flush if batch is full
        if (buffer.length >= this.batchSize) {
          await this.flushBatch(eventType);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to buffer event ${eventType}`, error);
    }
  }

  /**
   * Flush a specific event type batch
   */
  private async flushBatch(eventType: EventType): Promise<void> {
    const buffer = this.batchBuffer.get(eventType);
    if (!buffer || buffer.length === 0 || !this.client) {
      return;
    }

    const events = [...buffer];
    buffer.length = 0; // Clear buffer

    try {
      const tableName = this.getTableName(eventType);
      const values = events.map((event) => this.eventToRow(eventType, event));

      await this.client.insert({
        table: tableName,
        values,
        format: 'JSONEachRow',
      });

      this.logger.debug(`Inserted ${events.length} events to ${tableName}`);
    } catch (error) {
      this.logger.error(`Failed to flush batch for ${eventType}`, error);
      // Re-add events to buffer for retry (at the end)
      buffer.push(...events);
    }
  }

  /**
   * Flush all batch buffers
   */
  private async flushAllBatches(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    this.batchBuffer.forEach((_, eventType) => {
      flushPromises.push(this.flushBatch(eventType));
    });

    await Promise.all(flushPromises);
  }

  /**
   * Start periodic batch flush timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flushAllBatches().catch((error) => {
        this.logger.error('Periodic flush failed', error);
      });
    }, this.batchTimeoutMs);
  }

  /**
   * Get table name for event type
   */
  private getTableName(eventType: EventType): string {
    const suffix = eventType.toLowerCase().replace('_', '');
    return `${this.tableNamePrefix}${suffix}_events`;
  }

  /**
   * Convert event to ClickHouse row format
   */
  private eventToRow(eventType: EventType, event: AnyEvent): Record<string, any> {
    switch (eventType) {
      case EventType.REQUEST:
        return this.requestEventToRow(event as any);
      case EventType.AD:
        return this.adEventToRow(event as any);
      case EventType.IMPRESSION:
        return this.impressionEventToRow(event as any);
      case EventType.CLICK:
        return this.clickEventToRow(event as any);
      case EventType.CONVERSION:
        return this.conversionEventToRow(event as any);
      case EventType.VIDEO_VTR:
        return this.videoVTREventToRow(event as any);
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }

  private requestEventToRow(event: any): Record<string, any> {
    return {
      request_id: event.requestId,
      event_time: this.toDateTime(event.eventTime),
      user_ids: {
        hashed_email: event.userIds?.hashedEmail || null,
        hashed_phone: event.userIds?.hashedPhone || null,
        device_id: event.userIds?.deviceId || null,
        cookie_id: event.userIds?.cookieId || null,
      },
      segments: event.segments || [],
      slot_id: event.slotId,
      slot_type: event.slotType || 'UNKNOWN',
      ip: event.ip || null,
      country: event.country || null,
      city: event.city || null,
      user_agent: event.userAgent || null,
      device_type: event.deviceType || null,
      os: event.os || null,
      browser: event.browser || null,
    };
  }

  private adEventToRow(event: any): Record<string, any> {
    return {
      request_id: event.requestId,
      impression_id: event.impressionId,
      click_id: event.clickId,
      campaign_id: event.campaignId,
      creative_id: event.creativeId,
      event_time: this.toDateTime(event.eventTime),
      bid: event.bid || 0,
      ecpm: event.ecpm || 0,
      cost: event.cost || 0,
      creative_type: event.creativeType || 'UNKNOWN',
      bid_type: event.bidType || 'UNKNOWN',
      pctr: event.pctr || 0,
      pcvr: event.pcvr || 0,
      slot_id: event.slotId || '',
    };
  }

  private impressionEventToRow(event: any): Record<string, any> {
    return {
      click_id: event.clickId,
      event_time: this.toDateTime(event.eventTime),
    };
  }

  private clickEventToRow(event: any): Record<string, any> {
    return {
      click_id: event.clickId,
      event_time: this.toDateTime(event.eventTime),
    };
  }

  private conversionEventToRow(event: any): Record<string, any> {
    return {
      click_id: event.clickId,
      event_time: this.toDateTime(event.eventTime),
      conversion_value: event.conversionValue || null,
      conversion_type: event.conversionType || null,
    };
  }

  private videoVTREventToRow(event: any): Record<string, any> {
    return {
      click_id: event.clickId,
      event_time: this.toDateTime(event.eventTime),
      event_type: event.eventType || 'UNKNOWN',
      progress_percent: event.progressPercent || 0,
    };
  }

  /**
   * Convert timestamp to ClickHouse DateTime64
   */
  private toDateTime(timestamp: number): string {
    return new Date(timestamp).toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * Check ClickHouse connection health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get writer statistics
   */
  getStats(): {
    connected: boolean;
    pendingEvents: number;
    batchSize: number;
    batchTimeoutMs: number;
  } {
    let pendingEvents = 0;
    this.batchBuffer.forEach((buffer) => {
      pendingEvents += buffer.length;
    });

    return {
      connected: this.client !== null,
      pendingEvents,
      batchSize: this.batchSize,
      batchTimeoutMs: this.batchTimeoutMs,
    };
  }
}
