import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import {
  AdminUserManualCheckDto,
  AdminUsersQueryDto,
  PaymentMethodDto,
  UserQueryDto,
} from './user.dto'
import { UserService } from './user.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

@ApiTags('User')
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('user/profile')
  getAppProfile(@Query() query: UserQueryDto) {
    return this.userService.getAppProfile(query)
  }

  @Get('user/recharge-history/check')
  hasRechargeHistory(@Query() query: UserQueryDto) {
    return this.userService.hasRechargeHistory(query)
  }

  @Get('user/payment-method')
  getPaymentMethod(@Query() query: UserQueryDto) {
    return this.userService.getPaymentMethod(query)
  }

  @Post('user/payment-method')
  @HttpCode(200)
  bindPaymentMethod(@Body() body: PaymentMethodDto) {
    return this.userService.bindPaymentMethod(body)
  }

  @Delete('user/payment-method')
  @HttpCode(200)
  unbindPaymentMethod(@Query() query: UserQueryDto) {
    return this.userService.unbindPaymentMethod(query)
  }

  @Get('app/assets/overview')
  getAssetOverview(@Query() query: UserQueryDto) {
    return this.userService.getAssetOverview(query)
  }

  @Get('public/leaderboard')
  getPublicLeaderboard() {
    return this.userService.getPublicLeaderboard()
  }

  @Get('public/gold-chain')
  getPublicGoldChain() {
    return this.userService.getPublicGoldChain()
  }

  @Get('admin/users/profile')
  @AdminProtected()
  getProfile(@Query() query: UserQueryDto) {
    return this.userService.getProfile(query)
  }

  @Get('admin/users')
  @AdminProtected()
  getAdminUsers(@Query() query: AdminUsersQueryDto) {
    return this.userService.getAdminUsers(query)
  }

  @Post('admin/users/:uid/manual-check')
  @HttpCode(200)
  @AdminProtected()
  manualCheckUser(@Param('uid') uid: string, @Body() body: AdminUserManualCheckDto, @Req() req: AdminRequest) {
    return this.userService.manualCheckUser(uid, body, {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    })
  }
}
