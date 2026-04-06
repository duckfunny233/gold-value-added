import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { NewsFeedService } from './news-feed.service'

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, NewsFeedService],
})
export class DashboardModule {}
