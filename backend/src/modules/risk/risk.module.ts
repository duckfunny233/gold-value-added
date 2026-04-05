import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Injectable()
class RiskService {
  getAlerts() {
    return [
      {
        id: 'risk-1',
        level: 'MEDIUM',
        type: 'WITHDRAW_REVIEW',
        message: '存在待处理提现订单，请及时审核。',
      },
    ]
  }
}

@ApiTags('Risk')
@Controller('admin/risk')
class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('alerts')
  getAlerts() {
    return this.riskService.getAlerts()
  }
}

@Module({
  controllers: [RiskController],
  providers: [RiskService],
})
export class RiskModule {}
