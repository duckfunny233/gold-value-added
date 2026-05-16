import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminLoginDto, AdminProfileQueryDto } from './admin-auth.dto'

const ADMIN_ROLE_INCLUDE = {
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
} as const

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(payload: AdminLoginDto) {
    const username = payload.username.trim()
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { username },
      include: ADMIN_ROLE_INCLUDE,
    })

    if (!adminUser) {
      throw new NotFoundException('管理员不存在')
    }

    if (adminUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('账号或密码错误')
    }

    if (adminUser.passwordHash !== sha256(payload.password)) {
      throw new UnauthorizedException('账号或密码错误')
    }

    const roleCodes = adminUser.roles.map((item) => item.role.code)
    const permissionCodes = this.collectPermissionCodes(adminUser.roles)
    const token = await this.jwtService.signAsync({
      sub: adminUser.id,
      username: adminUser.username,
      roleCodes,
      permissionCodes,
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: adminUser.id },
        data: { lastLoginAt: new Date() },
      })

      await tx.adminOperationLog.create({
        data: {
          adminUserId: adminUser.id,
          module: 'admin-auth',
          action: 'login',
          traceId: randomUUID(),
          payload: {
            username: adminUser.username,
            roleCodes,
          },
        },
      })
    })

    return {
      message: '后台登录成功',
      data: {
        token,
        adminUser: {
          username: adminUser.username,
          displayName: adminUser.displayName,
          roleCodes,
          permissionCodes,
        },
      },
    }
  }

  async getProfile(query: AdminProfileQueryDto, currentAdminUsername?: string) {
    const username = (query.username || currentAdminUsername || '').trim()
    if (!username) {
      throw new UnauthorizedException('管理员登录状态无效')
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { username },
      include: ADMIN_ROLE_INCLUDE,
    })

    if (!adminUser) {
      throw new NotFoundException('管理员不存在')
    }

    return {
      message: 'OK',
      data: {
        username: adminUser.username,
        displayName: adminUser.displayName,
        status: adminUser.status,
        lastLoginAt: adminUser.lastLoginAt,
        roles: adminUser.roles.map((item) => ({
          code: item.role.code,
          name: item.role.name,
        })),
        permissions: this.collectPermissionCodes(adminUser.roles),
      },
    }
  }

  private collectPermissionCodes(
    roles: Array<{
      role: {
        permissions: Array<{ permission: { code: string } }>
      }
    }>,
  ) {
    return Array.from(
      new Set(
        roles.flatMap((item) =>
          item.role.permissions.map((permissionItem) => permissionItem.permission.code),
        ),
      ),
    )
  }
}
