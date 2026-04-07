import { Module } from '@nestjs/common'
import { OperationIdempotencyService } from '../../common/services/operation-idempotency.service'
import { TradeController } from './trade.controller'
import { TradeService } from './trade.service'
import { TradeRuntimeService } from './trade-runtime.service'

@Module({
  controllers: [TradeController],
  providers: [TradeService, TradeRuntimeService, OperationIdempotencyService],
  exports: [TradeRuntimeService],
})
export class TradeModule {}
