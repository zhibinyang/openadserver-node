/**
 * Bid Log Module
 */

import { Module, Global } from '@nestjs/common';
import { BidLogService } from './bid-log.service';
import { BidLogController } from './bid-log.controller';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [BidLogController],
  providers: [BidLogService],
  exports: [BidLogService],
})
export class BidLogModule {}
