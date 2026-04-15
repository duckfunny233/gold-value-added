import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MarketService } from './market.service'

@ApiTags('Market')
@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('market/prices')
  getPrices() {
    return this.marketService.getPrices()
  }

  @Get('app/market/au9999/ticker')
  getTicker() {
    return this.marketService.getTicker('AU9999')
  }

  @Get('app/market/ag9999/ticker')
  getSilverTicker() {
    return this.marketService.getTicker('AG9999')
  }

  @Get('market/periods')
  getPeriods() {
    return this.marketService.getTradingPeriods()
  }

  @Get('market/kline')
  getKLine(@Query('asset') asset?: string, @Query('period') period?: string) {
    return this.marketService.getKLine(asset, period)
  }
}
