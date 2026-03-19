import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EngineModule } from './modules/engine/engine.module';
import { RedisModule } from './shared/redis/redis.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaapiModule } from './modules/paapi/paapi.module';
import { UserProfileModule } from './modules/user-profile/user-profile.module';
import { RtbModule } from './modules/rtb/rtb.module';
import { SspModule } from './modules/ssp/ssp.module';
import { BidLogModule } from './modules/bid-log/bid-log.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    RedisModule, // Global
    AnalyticsModule,
    EngineModule,
    TrackingModule,
    PaapiModule,
    UserProfileModule,
    RtbModule,
    SspModule,
    BidLogModule,
    EventsModule, // Global - Event production with LevelDB fallback
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
