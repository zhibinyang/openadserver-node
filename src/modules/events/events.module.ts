import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProtoEncoderService } from './producers/proto-encoder.service';
import { RocksDBFallbackService } from './producers/rocksdb-fallback.service';
import { EventProducerService } from './producers/event-producer.service';
import { KafkaProducerService } from './producers/kafka-producer.service';

// Kafka producer is optional - only created when KAFKA_ENABLED=true
const KafkaProducerProvider: Provider = {
  provide: KafkaProducerService,
  useFactory: (configService: ConfigService) => {
    const kafkaEnabled = configService.get<string>('KAFKA_ENABLED', 'false') === 'true';
    if (kafkaEnabled) {
      return new KafkaProducerService(configService);
    }
    return null as any;
  },
  inject: [ConfigService],
};

/**
 * Events Module
 *
 * Architecture:
 *   Node.js → Kafka → Flink (JOIN) → ClickHouse
 *                ↓
 *            LevelDB (fallback when Kafka unavailable)
 *
 * This module only handles event PRODUCTION.
 * Event consumption and ClickHouse writing is handled by Flink.
 */
@Global()
@Module({
  providers: [
    ProtoEncoderService,
    RocksDBFallbackService,
    KafkaProducerProvider,
    EventProducerService,
  ],
  exports: [
    ProtoEncoderService,
    RocksDBFallbackService,
    KafkaProducerService,
    EventProducerService,
  ],
})
export class EventsModule {}
