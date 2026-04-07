import { Module } from '@nestjs/common'
import { OperationIdempotencyService } from '../../common/services/operation-idempotency.service'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, OperationIdempotencyService],
})
export class PaymentModule {}
