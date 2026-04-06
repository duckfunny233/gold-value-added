import { Module } from '@nestjs/common'
import { TradeModule } from '../trade/trade.module'
import { MarketController } from './market.controller'
import { MarketService } from './market.service'

@Module({
  imports: [TradeModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
