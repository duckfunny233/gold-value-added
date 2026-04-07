import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminPermission } from '../admin-auth/admin-permission.decorator'
import { ADMIN_PERMISSION_CODES } from '../admin-auth/admin-permission-codes'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { LeaderboardActionDto, LeaderboardQueryDto, LeaderboardRuleDto } from './leaderboard.dto'
import { LeaderboardService } from './leaderboard.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

@ApiTags('Leaderboard')
@Controller('admin/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @AdminProtected()
  getOverview(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getOverview(query)
  }

  @Post('rule')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.LEADERBOARD_RULE_UPDATE)
  updateRule(@Body() body: LeaderboardRuleDto, @Req() req: AdminRequest) {
    return this.leaderboardService.updateRule(body, this.requireAdmin(req))
  }

  @Post('rebuild')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.LEADERBOARD_REBUILD)
  rebuild(@Body() body: LeaderboardActionDto, @Req() req: AdminRequest) {
    return this.leaderboardService.rebuild(body, this.requireAdmin(req))
  }

  @Post('retry-sync')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.LEADERBOARD_RETRY_SYNC)
  retrySync(@Body() body: LeaderboardActionDto, @Req() req: AdminRequest) {
    return this.leaderboardService.retrySync(body, this.requireAdmin(req))
  }

  private requireAdmin(req: AdminRequest) {
    return {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    }
  }
}
