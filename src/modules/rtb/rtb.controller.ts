import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { RtbService } from './rtb.service';
import { BidRequestDto, OpenRtbBidRequest } from './dto/bid-request.dto';

/**
 * RTB Controller - OpenRTB endpoints
 */
@Controller('rtb')
export class RtbController {
  private readonly logger = new Logger(RtbController.name);

  constructor(private readonly rtbService: RtbService) {}

  /**
   * OpenRTB Bid Endpoint
   * POST /rtb/bid
   */
  @Post('bid')
  @HttpCode(HttpStatus.OK)
  async bid(@Body() bidRequest: BidRequestDto) {
    // Validate basic structure
    if (!bidRequest.id || !bidRequest.imp || bidRequest.imp.length === 0) {
      throw new BadRequestException('Invalid BidRequest: missing id or imp');
    }

    this.logger.debug(
      `Received BidRequest ${bidRequest.id}: ${bidRequest.imp.length} impressions, ` +
      `${bidRequest.site ? 'site' : bidRequest.app ? 'app' : 'unknown'} context`
    );

    // Process the bid request - cast to the expected type
    const response = await this.rtbService.processBidRequest(bidRequest as unknown as OpenRtbBidRequest);

    return response;
  }

  /**
   * Win Notice Endpoint
   * GET /rtb/win
   */
  @Get('win')
  async win(
    @Query('campaign_id') campaignId: string,
    @Query('creative_id') creativeId: string,
    @Query('price') price: string,
    @Query('bid_id') bidId?: string,
    @Query('imp_id') impId?: string,
  ) {
    if (!campaignId || !creativeId || !price) {
      throw new BadRequestException('Missing required parameters');
    }

    await this.rtbService.handleWinNotice({
      campaignId: parseInt(campaignId, 10),
      creativeId: parseInt(creativeId, 10),
      price: parseFloat(price),
      bidId,
      impId,
    });

    return { status: 'ok' };
  }

  /**
   * Loss Notice Endpoint
   * GET /rtb/loss
   */
  @Get('loss')
  async loss(
    @Query('campaign_id') campaignId: string,
    @Query('creative_id') creativeId: string,
    @Query('winning_price') winningPrice?: string,
    @Query('bid_id') bidId?: string,
  ) {
    if (!campaignId || !creativeId) {
      throw new BadRequestException('Missing required parameters');
    }

    await this.rtbService.handleLossNotice({
      campaignId: parseInt(campaignId, 10),
      creativeId: parseInt(creativeId, 10),
      winningPrice: winningPrice ? parseFloat(winningPrice) : undefined,
      bidId,
    });

    return { status: 'ok' };
  }

  /**
   * Health check for RTB endpoint
   * GET /rtb/health
   */
  @Get('health')
  health() {
    return {
      status: 'healthy',
      version: '1.0.0',
      protocol: 'OpenRTB 2.6',
    };
  }

  /**
   * Test endpoint for debugging
   * POST /rtb/test
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async test() {
    // Return a simple test response
    return {
      status: 'ok',
      message: 'RTB endpoint is operational',
      timestamp: new Date().toISOString(),
    };
  }
}
