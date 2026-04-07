import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminTradesQueryDto, TradeDto, TradeQueryDto } from './trade.dto'
import { TradeService } from './trade.service'

@ApiTags('Trade')
@Controller()
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Post('app/trades/buy')
  @HttpCode(200)
  submitBuy(@Body() body: TradeDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.tradeService.submit('BUY', body, idempotencyKey)
  }

  @Post('app/trades/sell')
  @HttpCode(200)
  submitSell(@Body() body: TradeDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.tradeService.submit('SELL', body, idempotencyKey)
  }

  @Get('app/trades')
  getTrades(@Query() query: TradeQueryDto) {
    return this.tradeService.getOrders(query)
  }

  @Get('admin/trades/overview')
  @AdminProtected()
  getAdminOverview() {
    return this.tradeService.getAdminOverview()
  }

  @Get('admin/trades/session-status')
  @AdminProtected()
  getAdminSessionStatus() {
    return this.tradeService.getAdminOverview()
  }

  @Get('admin/trades')
  @AdminProtected()
  getAdminTrades(@Query() query: AdminTradesQueryDto) {
    return this.tradeService.getAdminTrades(query)
  }
}
