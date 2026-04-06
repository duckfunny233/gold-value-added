import { Module } from '@nestjs/common'
import { TradeController } from './trade.controller'
import { TradeService } from './trade.service'
import { TradeRuntimeService } from './trade-runtime.service'

@Module({
  controllers: [TradeController],
  providers: [TradeService, TradeRuntimeService],
  exports: [TradeRuntimeService],
})
export class TradeModule {}
