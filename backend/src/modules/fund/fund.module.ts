import { Body, Controller, Get, Injectable, Module, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createHash, randomUUID } from 'crypto'

type RechargeDto = {
  channel: 'wechat' | 'alipay' | 'bank'
  amount: number
}

type WithdrawDto = {
  amount: number
  payeeName?: string
  wechatReceiptUrl?: string
  alipayReceiptUrl?: string
  bankName?: string
  bankAccountNo?: string
  bankAccountHolder?: string
}

@Injectable()
class FundService {
  createRecharge(body: RechargeDto) {
    const traceId = randomUUID()
    return {
      message: '充值订单创建成功',
      data: {
        orderId: randomUUID(),
        traceId,
        channel: body.channel,
        amount: body.amount,
        status: 'PENDING',
        autoSettleAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        sha256: createHash('sha256').update(`${traceId}:${body.amount}`).digest('hex'),
      },
    }
  }

  createWithdrawal(body: WithdrawDto) {
    const traceId = randomUUID()
    return {
      message: '提现申请已提交',
      data: {
        orderId: randomUUID(),
        traceId,
        amount: body.amount,
        status: 'PENDING',
        queueNo: 1,
        assetEffect: {
          tentativeAssetDelta: -body.amount,
          totalAssetDelta: -body.amount,
          withdrawFrozenAmountDelta: body.amount,
        },
      },
    }
  }

  getRechargeOrders() {
    return [
      {
        orderId: 'recharge-demo-1',
        uid: 'UID20260001',
        channel: 'wechat',
        amount: 5000,
        status: 'PROCESSING',
      },
    ]
  }

  getWithdrawalOrders() {
    return [
      {
        orderId: 'withdraw-demo-1',
        uid: 'UID20260001',
        amount: 3000,
        status: 'PENDING',
        queueNo: 1,
        submittedAt: new Date().toISOString(),
        isVoiceMuted: false,
      },
    ]
  }

  approveWithdrawal(orderId: string) {
    return {
      message: '提现审核通过，订单待线下打款确认',
      data: {
        orderId,
        status: 'APPROVED',
      },
    }
  }
}

@ApiTags('Fund')
@Controller()
class FundController {
  constructor(private readonly fundService: FundService) {}

  @Post('app/recharges')
  createRecharge(@Body() body: RechargeDto) {
    return this.fundService.createRecharge(body)
  }

  @Get('app/recharges')
  getRecharges() {
    return this.fundService.getRechargeOrders()
  }

  @Post('app/withdrawals')
  createWithdrawal(@Body() body: WithdrawDto) {
    return this.fundService.createWithdrawal(body)
  }

  @Get('app/withdrawals')
  getWithdrawals() {
    return this.fundService.getWithdrawalOrders()
  }

  @Get('admin/funds/recharges')
  getAdminRecharges() {
    return this.fundService.getRechargeOrders()
  }

  @Get('admin/funds/withdrawals')
  getAdminWithdrawals() {
    return this.fundService.getWithdrawalOrders()
  }

  @Post('admin/funds/withdrawals/:orderId/approve')
  approveWithdrawal(@Param('orderId') orderId: string) {
    return this.fundService.approveWithdrawal(orderId)
  }
}

@Module({
  controllers: [FundController],
  providers: [FundService],
})
export class FundModule {}
