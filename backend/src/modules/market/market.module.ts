import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Injectable()
class MarketService {
  getTicker() {
    return {
      assetCode: 'AU9999',
      price: 568.32,
      change: '+0.56%',
      precision: 0.01,
      refreshSeconds: 3,
      timestamp: new Date().toISOString(),
    }
  }
}

@ApiTags('Market')
@Controller()
class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('app/market/au9999/ticker')
  getTicker() {
    return this.marketService.getTicker()
  }
}

@Module({
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
