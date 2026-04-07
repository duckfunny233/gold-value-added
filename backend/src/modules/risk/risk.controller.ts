import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminPermission } from '../admin-auth/admin-permission.decorator'
import { ADMIN_PERMISSION_CODES } from '../admin-auth/admin-permission-codes'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminRiskQueryDto, RiskRulesDto } from './risk.dto'
import { RiskService } from './risk.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

@ApiTags('Risk')
@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('admin/risk')
  @AdminProtected()
  getAdminRisk(@Query() query: AdminRiskQueryDto) {
    return this.riskService.getAdminRisk(query)
  }

  @Get('admin/risk/alerts')
  @AdminProtected()
  getAlerts() {
    return this.riskService.getAlerts()
  }

  @Get('admin/risk/rules')
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.RISK_RULE_READ)
  getRules() {
    return this.riskService.getRules()
  }

  @Post('admin/risk/rules')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.RISK_RULE_UPDATE)
  updateRules(@Req() req: AdminRequest, @Body() body: RiskRulesDto) {
    return this.riskService.updateRules(body, this.requireAdmin(req))
  }

  @Post('admin/users/:uid/freeze')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.RISK_USER_FREEZE)
  freezeUser(@Param('uid') uid: string, @Req() req: AdminRequest) {
    return this.riskService.freezeUser(uid, this.requireAdmin(req))
  }

  @Post('admin/users/:uid/unfreeze')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.RISK_USER_UNFREEZE)
  unfreezeUser(@Param('uid') uid: string, @Req() req: AdminRequest) {
    return this.riskService.unfreezeUser(uid, this.requireAdmin(req))
  }

  @Post('admin/trades/pause')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.TRADE_PAUSE)
  pauseTrading(@Req() req: AdminRequest) {
    return this.riskService.pauseTrading(this.requireAdmin(req))
  }

  @Post('admin/trades/resume')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.TRADE_RESUME)
  resumeTrading(@Req() req: AdminRequest) {
    return this.riskService.resumeTrading(this.requireAdmin(req))
  }

  private requireAdmin(req: AdminRequest) {
    return {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    }
  }
}
