import { Body, Controller, Get, Injectable, Module, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

type NoticeDto = {
  title: string
  content: string
}

@Injectable()
class DashboardService {
  getOverview() {
    return {
      pendingWithdrawals: 6,
      rechargeProcessingCount: 12,
      matchingExceptionCount: 0,
      blockchainSyncDelayCount: 0,
      marketStatus: 'OPEN',
    }
  }

  publishNotice(body: NoticeDto) {
    return {
      message: '公告发布成功',
      data: {
        noticeId: `notice-${Date.now()}`,
        title: body.title,
        content: body.content,
        status: 'PUBLISHED',
      },
    }
  }

  getNotices() {
    return [
      {
        noticeId: 'notice-demo-1',
        title: '系统调试公告',
        content: '当前后端已切换到 NestJS 模块化骨架。',
        status: 'PUBLISHED',
      },
    ]
  }
}

@ApiTags('Dashboard')
@Controller()
class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/dashboard/overview')
  getOverview() {
    return this.dashboardService.getOverview()
  }

  @Post('admin/dashboard/notices')
  publishNotice(@Body() body: NoticeDto) {
    return this.dashboardService.publishNotice(body)
  }

  @Get('app/notices')
  getAppNotices() {
    return this.dashboardService.getNotices()
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
