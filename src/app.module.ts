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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
