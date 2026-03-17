import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EventType } from '../types/event.types';
import { KafkaConsumerService } from '../consumers/kafka-consumer.service';
import { ClickHouseWriterService } from '../writers/clickhouse-writer.service';

@Injectable()
export class EventProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventProcessorService.name);
  private readonly enableDualWrite: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly kafkaConsumer: KafkaConsumerService,
    private readonly clickhouseWriter: ClickHouseWriterService,
  ) {
    // Dual write mode: write to both Postgres (via legacy AnalyticsService) and ClickHouse
    this.enableDualWrite = this.configService.get<string>('EVENT_DUAL_WRITE_ENABLED', 'true') === 'true';
  }

  async onModuleInit(): Promise<void> {
    const kafkaConsumerEnabled = this.configService.get<string>('KAFKA_CONSUMER_ENABLED', 'false') === 'true';

    if (!kafkaConsumerEnabled) {
      this.logger.log('Event processor disabled (Kafka consumer not enabled)');
      return;
    }

    // Set up message handler
    this.kafkaConsumer.setMessageHandler(this.processMessage.bind(this));
    this.logger.log('Event processor initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Event processor destroyed');
  }

  /**
   * Process a message from Kafka
   */
  private async processMessage(eventType: EventType, data: Buffer): Promise<void> {
    try {
      // Write to ClickHouse
      await this.clickhouseWriter.write(eventType, data);
      this.logger.debug(`Processed ${eventType} event`);
    } catch (error) {
      this.logger.error(`Failed to process ${eventType} event`, error);
      throw error;
    }
  }

  /**
   * Get processor statistics
   */
  async getStats(): Promise<{
    dualWriteEnabled: boolean;
    kafka: Awaited<ReturnType<typeof this.kafkaConsumer.getStats>>;
    clickhouse: ReturnType<typeof this.clickhouseWriter.getStats>;
  }> {
    return {
      dualWriteEnabled: this.enableDualWrite,
      kafka: await this.kafkaConsumer.getStats(),
      clickhouse: this.clickhouseWriter.getStats(),
    };
  }
}
