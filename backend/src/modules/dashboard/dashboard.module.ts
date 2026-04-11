import { Module } from '@nestjs/common'
import { MarketModule } from '../market/market.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { NewsController } from './news.controller'
import { NewsFeedService } from './news-feed.service'

@Module({
  imports: [MarketModule],
  controllers: [DashboardController, NewsController],
  providers: [DashboardService, NewsFeedService],
})
export class DashboardModule {}
