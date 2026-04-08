import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminUserManualCheckDto, AdminUsersQueryDto, UserQueryDto } from './user.dto'
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

  @Get('app/assets/overview')
  getAssetOverview(@Query() query: UserQueryDto) {
    return this.userService.getAssetOverview(query)
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
