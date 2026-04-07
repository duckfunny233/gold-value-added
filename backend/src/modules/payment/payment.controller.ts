import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import {
  AdminPaymentsQueryDto,
  PaymentQrQueryDto,
  PaymentRecordsQueryDto,
  PaymentTransferDto,
} from './payment.dto'
import { PaymentService } from './payment.service'

@ApiTags('Payment')
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('app/payments/qr')
  getQr(@Query() query: PaymentQrQueryDto) {
    return this.paymentService.getQrProfile(query)
  }

  @Post('app/payments/transfer')
  @HttpCode(200)
  transfer(@Body() body: PaymentTransferDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.paymentService.transfer(body, idempotencyKey)
  }

  @Get('app/payments/records')
  getRecords(@Query() query: PaymentRecordsQueryDto) {
    return this.paymentService.getPaymentRecords(query)
  }

  @Get('admin/payments')
  @AdminProtected()
  getAdminPayments(@Query() query: AdminPaymentsQueryDto) {
    return this.paymentService.getAdminPayments(query)
  }

  @Get('admin/payments/overview')
  @AdminProtected()
  getAdminOverview() {
    return this.paymentService.getAdminOverview()
  }
}
