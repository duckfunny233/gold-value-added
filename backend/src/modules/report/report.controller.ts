import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminReportsQueryDto } from './report.dto'
import { ReportService } from './report.service'

@ApiTags('Report')
@Controller('admin/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @AdminProtected()
  getAdminReports(@Query() query: AdminReportsQueryDto) {
    return this.reportService.getAdminReports(query)
  }

  @Get('overview')
  @AdminProtected()
  getOverview() {
    return this.reportService.getOverview()
  }
}
