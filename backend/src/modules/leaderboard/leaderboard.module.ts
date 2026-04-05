import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Injectable()
class LeaderboardService {
  getOverview() {
    return {
      rule: 'TOTAL_ASSET',
      syncStatus: 'HEALTHY',
      topUsers: [
        { uid: 'UID20260001', totalAsset: 199400 },
        { uid: 'UID20260002', totalAsset: 168800 },
      ],
    }
  }
}

@ApiTags('Leaderboard')
@Controller('admin/leaderboard')
class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getOverview() {
    return this.leaderboardService.getOverview()
  }
}

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
