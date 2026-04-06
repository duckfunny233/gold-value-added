import { applyDecorators, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'

export function AdminProtected() {
  return applyDecorators(
    UseGuards(AdminJwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: '管理员未登录或 token 已失效',
    }),
  )
}
