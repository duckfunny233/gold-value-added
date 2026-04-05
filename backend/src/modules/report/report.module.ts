import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Injectable()
class ReportService {
  getOverview() {
    return {
      todayRechargeAmount: 128000,
      todayWithdrawAmount: 43000,
      todayTradeVolumeGrams: 552.4,
      totalUsers: 1288,
    }
  }
}

@ApiTags('Report')
@Controller('admin/reports')
class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('overview')
  getOverview() {
    return this.reportService.getOverview()
  }
}

@Module({
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
