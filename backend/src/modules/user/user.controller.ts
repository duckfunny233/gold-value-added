import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminUsersQueryDto, UserQueryDto } from './user.dto'
import { UserService } from './user.service'

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
}
