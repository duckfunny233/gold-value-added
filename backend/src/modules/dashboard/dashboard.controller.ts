import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { DashboardQueryDto, PublishNoticeDto } from './dashboard.dto'
import { DashboardService } from './dashboard.service'

type TraceableRequest = Request & {
  traceId?: string
}

@ApiTags('Dashboard')
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/dashboard')
  @AdminProtected()
  async getDashboard(@Query() query: DashboardQueryDto, @Req() req: TraceableRequest) {
    const result = await this.dashboardService.getDashboard(query)

    return {
      code: 200,
      message: result.meta.code || 'OK',
      traceId: req.traceId,
      data: result.data,
    }
  }

  @Get('admin/dashboard/overview')
  @AdminProtected()
  async getDashboardOverview(@Query() query: DashboardQueryDto, @Req() req: TraceableRequest) {
    return this.getDashboard(query, req)
  }

  @Post('admin/dashboard/notices')
  @HttpCode(200)
  @AdminProtected()
  async publishNotice(@Body() body: PublishNoticeDto, @Req() req: TraceableRequest) {
    const notice = await this.dashboardService.publishNotice(body)

    return {
      code: 200,
      message: '公告发布成功',
      traceId: req.traceId,
      data: notice,
    }
  }

  @Get('app/notices')
  async getAppNotices(@Req() req: TraceableRequest) {
    const result = await this.dashboardService.getAppNoticeFeed()

    return {
      code: 200,
      message: result.meta.code || 'OK',
      traceId: req.traceId,
      data: result.notices.map(({ sortTimestamp: _sortTimestamp, ...item }) => item),
    }
  }

  @Get('notice')
  async getLegacyNotice(@Req() req: TraceableRequest) {
    const result = await this.dashboardService.getAppNoticeFeed()
    const notices = result.notices.map(({ sortTimestamp: _sortTimestamp, ...item }) => item)
    const firstText = notices[0]?.text || notices[0]?.title || '暂无公告'

    return {
      code: 200,
      message: result.meta.code || 'OK',
      traceId: req.traceId,
      data: {
        text: firstText,
        notices,
      },
      text: firstText,
    }
  }
}
