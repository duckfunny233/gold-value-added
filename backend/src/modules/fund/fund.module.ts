import { Module } from '@nestjs/common'
import { OperationIdempotencyService } from '../../common/services/operation-idempotency.service'
import { FundController } from './fund.controller'
import { FundService } from './fund.service'

@Module({
  controllers: [FundController],
  providers: [FundService, OperationIdempotencyService],
})
export class FundModule {}
