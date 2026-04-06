import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common'
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
  submitBuy(@Body() body: TradeDto) {
    return this.tradeService.submit('BUY', body)
  }

  @Post('app/trades/sell')
  @HttpCode(200)
  submitSell(@Body() body: TradeDto) {
    return this.tradeService.submit('SELL', body)
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
