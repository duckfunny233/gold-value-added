import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserStatus } from '@prisma/client'
import { Request } from 'express'
import { PrismaService } from '../../prisma/prisma.service'
import { ADMIN_PERMISSION_KEY } from './admin-permission.decorator'

type AdminRequest = Request & {
  user?: {
    adminUserId?: string
    username?: string
    roleCodes?: string[]
    permissionCodes?: string[]
  }
}

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(ADMIN_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || []

    if (requiredPermissions.length === 0) {
      return true
    }

    const req = context.switchToHttp().getRequest<AdminRequest>()
    const adminUserId = req.user?.adminUserId

    if (!adminUserId) {
      throw new UnauthorizedException('管理员登录状态无效')
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: {
        id: adminUserId,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!adminUser || adminUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('管理员登录状态无效')
    }

    const roleCodes = adminUser.roles.map((item) => item.role.code)
    const permissionCodes = Array.from(
      new Set(
        adminUser.roles.flatMap((item) =>
          item.role.permissions.map((permissionItem) => permissionItem.permission.code),
        ),
      ),
    )

    req.user = {
      ...req.user,
      adminUserId: adminUser.id,
      username: adminUser.username,
      roleCodes,
      permissionCodes,
    }

    if (!requiredPermissions.every((code) => permissionCodes.includes(code))) {
      throw new ForbiddenException('管理员权限不足')
    }

    return true
  }
}
