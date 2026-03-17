import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProtoEncoderService } from './producers/proto-encoder.service';
import { ProtoDecoderService } from './producers/proto-decoder.service';
import { RocksDBFallbackService } from './producers/rocksdb-fallback.service';
import { EventProducerService } from './producers/event-producer.service';
import { KafkaProducerService } from './producers/kafka-producer.service';
import { KafkaConsumerService } from './consumers/kafka-consumer.service';
import { ClickHouseWriterService } from './writers/clickhouse-writer.service';
import { EventProcessorService } from './processors/event-processor.service';

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

const KafkaConsumerProvider: Provider = {
  provide: KafkaConsumerService,
  useFactory: (configService: ConfigService) => {
    const kafkaEnabled = configService.get<string>('KAFKA_ENABLED', 'false') === 'true';
    const consumerEnabled = configService.get<string>('KAFKA_CONSUMER_ENABLED', 'false') === 'true';
    if (kafkaEnabled && consumerEnabled) {
      return new KafkaConsumerService(configService);
    }
    return null as any;
  },
  inject: [ConfigService],
};

const ClickHouseWriterProvider: Provider = {
  provide: ClickHouseWriterService,
  useFactory: (configService: ConfigService, protoDecoder: ProtoDecoderService) => {
    const clickhouseEnabled = configService.get<string>('CLICKHOUSE_ENABLED', 'false') === 'true';
    if (clickhouseEnabled) {
      return new ClickHouseWriterService(configService, protoDecoder);
    }
    return null as any;
  },
  inject: [ConfigService, ProtoDecoderService],
};

const EventProcessorProvider: Provider = {
  provide: EventProcessorService,
  useFactory: (
    configService: ConfigService,
    kafkaConsumer: KafkaConsumerService,
    clickhouseWriter: ClickHouseWriterService,
  ) => {
    const consumerEnabled = configService.get<string>('KAFKA_CONSUMER_ENABLED', 'false') === 'true';
    if (consumerEnabled && kafkaConsumer && clickhouseWriter) {
      return new EventProcessorService(configService, kafkaConsumer, clickhouseWriter);
    }
    return null as any;
  },
  inject: [ConfigService, KafkaConsumerService, ClickHouseWriterService],
};

@Global()
@Module({
  providers: [
    ProtoEncoderService,
    ProtoDecoderService,
    RocksDBFallbackService,
    KafkaProducerProvider,
    KafkaConsumerProvider,
    ClickHouseWriterProvider,
    EventProcessorProvider,
    EventProducerService,
  ],
  exports: [
    ProtoEncoderService,
    ProtoDecoderService,
    RocksDBFallbackService,
    KafkaProducerService,
    KafkaConsumerService,
    ClickHouseWriterService,
    EventProcessorService,
    EventProducerService,
  ],
})
export class EventsModule {}
