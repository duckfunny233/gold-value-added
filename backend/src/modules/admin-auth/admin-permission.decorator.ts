import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiForbiddenResponse } from '@nestjs/swagger'
import { AdminPermissionGuard } from './admin-permission.guard'

export const ADMIN_PERMISSION_KEY = 'admin_permission_codes'

export function AdminPermission(...permissionCodes: string[]) {
  return applyDecorators(
    SetMetadata(ADMIN_PERMISSION_KEY, permissionCodes),
    UseGuards(AdminPermissionGuard),
    ApiForbiddenResponse({
      description: '管理员权限不足',
    }),
  )
}
