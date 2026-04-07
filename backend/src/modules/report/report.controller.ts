import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import {
  AdminReportsQueryDto,
  ReportGenerateDto,
  ReportJobExportDto,
  ReportJobsQueryDto,
  ReportTemplateCreateDto,
  ReportTemplatesQueryDto,
} from './report.dto'
import { ReportService } from './report.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

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

  @Post('generate')
  @HttpCode(200)
  @AdminProtected()
  generate(@Body() body: ReportGenerateDto, @Req() req: AdminRequest) {
    return this.reportService.generateReport(body, this.requireAdmin(req))
  }

  @Get('jobs')
  @AdminProtected()
  getJobs(@Query() query: ReportJobsQueryDto) {
    return this.reportService.getJobs(query)
  }

  @Get('jobs/:jobId')
  @AdminProtected()
  getJobDetail(@Param('jobId') jobId: string) {
    return this.reportService.getJobDetail(jobId)
  }

  @Post('jobs/:jobId/export')
  @HttpCode(200)
  @AdminProtected()
  exportJob(@Param('jobId') jobId: string, @Body() body: ReportJobExportDto, @Req() req: AdminRequest) {
    return this.reportService.exportJob(jobId, body, this.requireAdmin(req))
  }

  @Post('templates')
  @HttpCode(200)
  @AdminProtected()
  createTemplate(@Body() body: ReportTemplateCreateDto, @Req() req: AdminRequest) {
    return this.reportService.createTemplate(body, this.requireAdmin(req))
  }

  @Get('templates')
  @AdminProtected()
  getTemplates(@Query() query: ReportTemplatesQueryDto) {
    return this.reportService.getTemplates(query)
  }

  private requireAdmin(req: AdminRequest) {
    return {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    }
  }
}
