import { Module } from '@nestjs/common';
import { RtbController } from './rtb.controller';
import { RtbService } from './rtb.service';
import { RequestMapper } from './mappers/request.mapper';
import { ResponseMapper } from './mappers/response.mapper';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [EngineModule],
  controllers: [RtbController],
  providers: [RtbService, RequestMapper, ResponseMapper],
  exports: [RtbService],
})
export class RtbModule {}
