import { Body, Controller, Get, Injectable, Module, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { randomUUID } from 'crypto'

type TradeDto = {
  price: number
  quantityGrams: number
  assetCode?: string
}

@Injectable()
class TradeService {
  submit(side: 'BUY' | 'SELL', body: TradeDto) {
    return {
      message: side === 'BUY' ? '买单提交成功' : '卖单提交成功',
      data: {
        orderId: randomUUID(),
        traceId: randomUUID(),
        side,
        status: 'OPEN',
        assetCode: body.assetCode || 'AU9999',
        price: body.price,
        quantityGrams: body.quantityGrams,
        matchingRule: 'PRICE_TIME_PRIORITY',
      },
    }
  }

  getOrders() {
    return [
      {
        orderId: 'trade-demo-1',
        side: 'BUY',
        status: 'PARTIALLY_FILLED',
        assetCode: 'AU9999',
        price: 568.2,
        quantityGrams: 10,
        filledGrams: 2,
      },
    ]
  }

  getAdminOverview() {
    return {
      marketStatus: 'OPEN',
      tradingWindow: '09:00-23:00',
      pendingSyncCount: 0,
      matchingRule: '高买优先，同价按时间优先',
    }
  }
}

@ApiTags('Trade')
@Controller()
class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Post('app/trades/buy')
  submitBuy(@Body() body: TradeDto) {
    return this.tradeService.submit('BUY', body)
  }

  @Post('app/trades/sell')
  submitSell(@Body() body: TradeDto) {
    return this.tradeService.submit('SELL', body)
  }

  @Get('app/trades')
  getTrades() {
    return this.tradeService.getOrders()
  }

  @Get('admin/trades/overview')
  getAdminOverview() {
    return this.tradeService.getAdminOverview()
  }
}

@Module({
  controllers: [TradeController],
  providers: [TradeService],
})
export class TradeModule {}
