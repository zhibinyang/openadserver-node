import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EngineModule } from './modules/engine/engine.module';
import { RedisModule } from './shared/redis/redis.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaapiModule } from './modules/paapi/paapi.module';
import { UserProfileModule } from './modules/user-profile/user-profile.module';
import { RtbModule } from './modules/rtb/rtb.module';
import { SspModule } from './modules/ssp/ssp.module';
import { BidLogModule } from './modules/bid-log/bid-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    RedisModule, // Global
    EngineModule,
    TrackingModule,
    AdminModule,
    PaapiModule,
    UserProfileModule,
    RtbModule,
    SspModule,
    BidLogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
