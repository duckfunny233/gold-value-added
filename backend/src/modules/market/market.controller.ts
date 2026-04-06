import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MarketService } from './market.service'

@ApiTags('Market')
@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('app/market/au9999/ticker')
  getTicker() {
    return this.marketService.getTicker()
  }

  @Get('market/periods')
  getPeriods() {
    return this.marketService.getTradingPeriods()
  }
}
