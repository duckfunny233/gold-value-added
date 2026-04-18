import { Controller, Get, GoneException, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { NewsFeedService } from './news-feed.service'

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsFeedService: NewsFeedService) {}

  @Get()
  async getNewsList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('scene') scene?: string,
  ) {
    const normalizedScene = String(scene || '').toLowerCase()
    if (['news-list', 'legacy-news-list', 'list-page'].includes(normalizedScene)) {
      throw new GoneException('新闻功能已迁移至首页轮播')
    }

    return this.newsFeedService.getNewsList(Number(page || '1'), Number(limit || '10'))
  }

  @Get(':id')
  async getNewsDetail(@Param('id') id: string) {
    return this.newsFeedService.getNewsDetail(id)
  }
}
