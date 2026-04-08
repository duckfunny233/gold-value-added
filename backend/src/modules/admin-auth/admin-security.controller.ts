import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminPermission } from './admin-permission.decorator'
import { ADMIN_PERMISSION_CODES } from './admin-permission-codes'
import { AdminProtected } from './admin-protected.decorator'
import { AssignAdminRolesDto, AssignRolePermissionsDto, CreateAdminUserDto } from './admin-security.dto'
import { AdminSecurityService } from './admin-security.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

@ApiTags('AdminSecurity')
@Controller('admin/security')
export class AdminSecurityController {
  constructor(private readonly adminSecurityService: AdminSecurityService) {}

  @Get('admin-users')
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.SECURITY_READ)
  getAdminUsers() {
    return this.adminSecurityService.getAdminUsers()
  }

  @Get('roles')
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.SECURITY_READ)
  getRoles() {
    return this.adminSecurityService.getRoles()
  }

  @Get('permissions')
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.SECURITY_READ)
  getPermissions() {
    return this.adminSecurityService.getPermissions()
  }

  @Post('admin-users')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.SECURITY_ASSIGN_ROLES)
  createAdminUser(@Body() body: CreateAdminUserDto, @Req() req: AdminRequest) {
    return this.adminSecurityService.createAdminUser(body, this.requireAdmin(req))
  }

  @Post('admin-users/:adminUserId/roles')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.SECURITY_ASSIGN_ROLES)
  assignAdminUserRoles(
    @Param('adminUserId') adminUserId: string,
    @Body() body: AssignAdminRolesDto,
    @Req() req: AdminRequest,
  ) {
    return this.adminSecurityService.assignAdminUserRoles(adminUserId, body, this.requireAdmin(req))
  }

  @Post('roles/:roleId/permissions')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.SECURITY_ASSIGN_PERMISSIONS)
  assignRolePermissions(@Param('roleId') roleId: string, @Body() body: AssignRolePermissionsDto, @Req() req: AdminRequest) {
    return this.adminSecurityService.assignRolePermissions(roleId, body, this.requireAdmin(req))
  }

  private requireAdmin(req: AdminRequest) {
    return {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    }
  }
}
