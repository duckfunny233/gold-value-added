import { Module } from '@nestjs/common'
import { MarketModule } from '../market/market.module'
import { ActivitiesController } from './activities.controller'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { NewsController } from './news.controller'
import { NewsFeedService } from './news-feed.service'

@Module({
  imports: [MarketModule],
  controllers: [DashboardController, NewsController, ActivitiesController],
  providers: [DashboardService, NewsFeedService],
})
export class DashboardModule {}
