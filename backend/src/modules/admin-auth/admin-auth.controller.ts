import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AdminLoginDto, AdminProfileQueryDto } from './admin-auth.dto'
import { AdminAuthService } from './admin-auth.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'

@ApiTags('AdminAuth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: AdminLoginDto) {
    return this.adminAuthService.login(body)
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  getProfile(@Query() query: AdminProfileQueryDto, @Req() req: { user: { username: string } }) {
    return this.adminAuthService.getProfile(query, req.user.username)
  }
}
