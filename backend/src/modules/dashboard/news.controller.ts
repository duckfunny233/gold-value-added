import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { NewsFeedService } from './news-feed.service'

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsFeedService: NewsFeedService) {}

  @Get()
  async getNewsList(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.newsFeedService.getNewsList(Number(page || '1'), Number(limit || '10'))
  }

  @Get(':id')
  async getNewsDetail(@Param('id') id: string) {
    return this.newsFeedService.getNewsDetail(id)
  }
}
