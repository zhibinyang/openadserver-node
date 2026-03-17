import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { EventType, AnyEvent } from '../types/event.types';
import { ProtoEncoderService } from './proto-encoder.service';
import { RocksDBFallbackService, KafkaProducerLike } from './rocksdb-fallback.service';
import { KafkaProducerService } from './kafka-producer.service';

export type EventProducerMode = 'kafka' | 'leveldb' | 'auto';

@Injectable()
export class EventProducerService implements OnModuleInit {
  private readonly logger = new Logger(EventProducerService.name);
  private readonly mode: EventProducerMode;
  private kafkaAvailable = false;
  private healthCheckFailures = 0;
  private readonly maxHealthCheckFailures = 3;

  constructor(
    private readonly configService: ConfigService,
    private readonly protoEncoder: ProtoEncoderService,
    private readonly fallbackService: RocksDBFallbackService,
    @Optional() private readonly kafkaProducer: KafkaProducerService,
  ) {
    const modeConfig = this.configService.get<string>('EVENT_PRODUCER_MODE', 'leveldb');
    this.mode = modeConfig as EventProducerMode;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Event producer initialized with mode: ${this.mode}`);

    if (this.mode === 'kafka' || this.mode === 'auto') {
      if (this.kafkaProducer) {
        this.kafkaAvailable = this.kafkaProducer.isReady();
        if (this.kafkaAvailable) {
          this.logger.log('Kafka producer is ready');
        } else {
          this.logger.warn('Kafka producer not ready, using LevelDB fallback');
        }
      } else {
        this.logger.warn('Kafka producer not available, using LevelDB fallback');
      }
    }
  }

  /**
   * Produce an event to Kafka or LevelDB fallback
   */
  async produce(eventType: EventType, event: AnyEvent): Promise<void> {
    try {
      // Serialize to protobuf
      const protoData = this.protoEncoder.encode(eventType, event);

      if (this.mode === 'leveldb') {
        // LevelDB-only mode
        await this.fallbackService.store(eventType, protoData);
        this.logger.debug(`Event ${eventType} stored in LevelDB`);
        return;
      }

      if (this.mode === 'kafka') {
        // Kafka-only mode
        if (this.kafkaAvailable && this.kafkaProducer) {
          try {
            await this.kafkaProducer.send(eventType, protoData);
            this.logger.debug(`Event ${eventType} sent to Kafka`);
            return;
          } catch (error) {
            this.logger.error('Kafka send failed in kafka-only mode', error);
            throw error;
          }
        } else {
          throw new Error('Kafka not available in kafka-only mode');
        }
      }

      if (this.mode === 'auto') {
        // Auto mode: try Kafka first, fallback to LevelDB
        if (this.kafkaAvailable && this.kafkaProducer) {
          try {
            await this.kafkaProducer.send(eventType, protoData);
            this.logger.debug(`Event ${eventType} sent to Kafka`);
            return;
          } catch (error) {
            this.logger.warn('Kafka send failed, falling back to LevelDB');
            this.kafkaAvailable = false;
            this.healthCheckFailures++;
          }
        }

        // Fallback to LevelDB
        await this.fallbackService.store(eventType, protoData);
        this.logger.debug(`Event ${eventType} stored in LevelDB fallback`);
      }
    } catch (error) {
      this.logger.error(`Failed to produce event ${eventType}`, error);
      throw error;
    }
  }

  /**
   * Produce a request event
   */
  async produceRequest(event: import('../types/event.types').RequestEvent): Promise<void> {
    return this.produce(EventType.REQUEST, event);
  }

  /**
   * Produce an ad event
   */
  async produceAd(event: import('../types/event.types').AdEvent): Promise<void> {
    return this.produce(EventType.AD, event);
  }

  /**
   * Produce an impression event
   */
  async produceImpression(event: import('../types/event.types').ImpressionEvent): Promise<void> {
    return this.produce(EventType.IMPRESSION, event);
  }

  /**
   * Produce a click event
   */
  async produceClick(event: import('../types/event.types').ClickEvent): Promise<void> {
    return this.produce(EventType.CLICK, event);
  }

  /**
   * Produce a conversion event
   */
  async produceConversion(event: import('../types/event.types').ConversionEvent): Promise<void> {
    return this.produce(EventType.CONVERSION, event);
  }

  /**
   * Produce a video VTR event
   */
  async produceVideoVTR(event: import('../types/event.types').VideoVTREvent): Promise<void> {
    return this.produce(EventType.VIDEO_VTR, event);
  }

  /**
   * Check if Kafka is currently available
   */
  isKafkaAvailable(): boolean {
    return this.kafkaAvailable;
  }

  /**
   * Get current producer mode
   */
  getMode(): EventProducerMode {
    return this.mode;
  }

  /**
   * Get fallback queue statistics
   */
  async getStats(): Promise<{
    mode: EventProducerMode;
    kafkaAvailable: boolean;
    fallback: {
      queueSize: number;
      maxQueueSize: number;
      oldestEventAge: number | null;
    };
    kafka?: {
      brokers: number;
      topics: number;
      connected: boolean;
    };
  }> {
    const fallbackStats = await this.fallbackService.getStats();

    const result: any = {
      mode: this.mode,
      kafkaAvailable: this.kafkaAvailable,
      fallback: fallbackStats,
    };

    if (this.kafkaProducer) {
      result.kafka = await this.kafkaProducer.getMetadata();
    }

    return result;
  }

  /**
   * Periodic check for Kafka recovery and flush
   * Runs every 30 seconds
   */
  @Cron('*/30 * * * * *')
  async checkAndRecover(): Promise<void> {
    if (this.mode === 'leveldb') {
      // No Kafka recovery needed in LevelDB-only mode
      return;
    }

    if (!this.kafkaAvailable && this.kafkaProducer) {
      // Attempt to reconnect to Kafka
      const healthy = await this.kafkaProducer.healthCheck();

      if (healthy) {
        this.kafkaAvailable = true;
        this.healthCheckFailures = 0;
        this.logger.log('Kafka connection recovered');

        // Flush pending events from LevelDB to Kafka
        await this.flushPendingEvents();
      } else {
        this.healthCheckFailures++;
        if (this.healthCheckFailures <= this.maxHealthCheckFailures) {
          this.logger.debug(`Kafka health check failed (${this.healthCheckFailures}/${this.maxHealthCheckFailures})`);
        }
      }
    }
  }

  /**
   * Flush pending events from LevelDB to Kafka
   */
  private async flushPendingEvents(): Promise<void> {
    if (!this.kafkaProducer || !this.kafkaAvailable) {
      return;
    }

    const queueSize = await this.fallbackService.getQueueCount();
    if (queueSize === 0) {
      return;
    }

    this.logger.log(`Flushing ${queueSize} pending events to Kafka...`);

    const result = await this.fallbackService.flushToKafka(
      this.kafkaProducer as KafkaProducerLike,
    );

    this.logger.log(`Flush complete: ${result.success} success, ${result.failed} failed`);
  }

  /**
   * Force flush pending events (manual trigger)
   */
  async forceFlush(): Promise<{ success: number; failed: number }> {
    if (!this.kafkaProducer) {
      throw new Error('Kafka producer not available');
    }

    if (!this.kafkaAvailable) {
      const healthy = await this.kafkaProducer.healthCheck();
      if (!healthy) {
        throw new Error('Kafka is not healthy');
      }
      this.kafkaAvailable = true;
    }

    return this.fallbackService.flushToKafka(this.kafkaProducer as KafkaProducerLike);
  }
}
