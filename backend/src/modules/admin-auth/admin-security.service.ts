import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { formatDateTime } from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { ADMIN_PERMISSION_DEFINITIONS } from './admin-permission-codes'
import { AssignAdminRolesDto, AssignRolePermissionsDto, CreateAdminUserDto } from './admin-security.dto'

type AdminActor = {
  adminUserId: string
  username: string
}

@Injectable()
export class AdminSecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminUsers() {
    await this.ensureSecurityBootstrap()
    const adminUsers = await this.prisma.adminUser.findMany({
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
      orderBy: {
        createdAt: 'asc',
      },
    })

    return {
      rows: adminUsers.map((item) => ({
        adminUserId: item.id,
        username: item.username,
        displayName: item.displayName || item.username,
        status: item.status,
        lastLoginAt: formatDateTime(item.lastLoginAt),
        roleIds: item.roles.map((roleItem) => roleItem.role.id),
        roleCodes: item.roles.map((roleItem) => roleItem.role.code),
        roleNames: item.roles.map((roleItem) => roleItem.role.name),
        permissionCodes: Array.from(
          new Set(
            item.roles.flatMap((roleItem) =>
              roleItem.role.permissions.map((permissionItem) => permissionItem.permission.code),
            ),
          ),
        ),
      })),
    }
  }

  async getRoles() {
    await this.ensureSecurityBootstrap()
    const roles = await this.prisma.adminRole.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return {
      rows: roles.map((item) => ({
        roleId: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        permissionIds: item.permissions.map((permissionItem) => permissionItem.permission.id),
        permissionCodes: item.permissions.map((permissionItem) => permissionItem.permission.code),
        permissionNames: item.permissions.map((permissionItem) => permissionItem.permission.name),
        adminUserCount: item.users.length,
      })),
    }
  }

  async getPermissions() {
    await this.ensureSecurityBootstrap()
    const permissions = await this.prisma.adminPermission.findMany({
      include: {
        roles: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return {
      rows: permissions.map((item) => ({
        permissionId: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        roleCount: item.roles.length,
      })),
    }
  }

  async assignAdminUserRoles(adminUserId: string, body: AssignAdminRolesDto, actor: AdminActor) {
    await this.ensureSecurityBootstrap()
    const [adminUser, roles] = await Promise.all([
      this.prisma.adminUser.findUnique({
        where: {
          id: adminUserId,
        },
      }),
      body.roleIds.length
        ? this.prisma.adminRole.findMany({
            where: {
              id: {
                in: body.roleIds,
              },
            },
          })
        : Promise.resolve([]),
    ])

    if (!adminUser) {
      throw new NotFoundException('管理员不存在')
    }
    if (roles.length !== body.roleIds.length) {
      throw new NotFoundException('存在无效角色')
    }

    const traceId = randomUUID()
    await this.prisma.$transaction(async (tx) => {
      await tx.adminUserRole.deleteMany({
        where: {
          adminUserId,
        },
      })

      if (body.roleIds.length > 0) {
        await tx.adminUserRole.createMany({
          data: body.roleIds.map((roleId) => ({
            adminUserId,
            roleId,
          })),
        })
      }

      await this.writeSecurityLogs(tx, {
        actor,
        action: 'security.admin-user.assign-roles',
        traceId,
        referenceType: 'ADMIN_USER_ROLE_ASSIGN',
        referenceId: adminUserId,
        payload: {
          adminUserId,
          roleIds: body.roleIds,
          roleCodes: roles.map((item) => item.code),
          result: '成功',
        } as Prisma.InputJsonValue,
      })
    })

    return {
      message: '管理员角色分配成功',
      data: {
        traceId,
        adminUserId,
        roleIds: body.roleIds,
        roleCodes: roles.map((item) => item.code),
      },
    }
  }

  async assignRolePermissions(roleId: string, body: AssignRolePermissionsDto, actor: AdminActor) {
    await this.ensureSecurityBootstrap()
    const [role, permissions] = await Promise.all([
      this.prisma.adminRole.findUnique({
        where: {
          id: roleId,
        },
      }),
      body.permissionIds.length
        ? this.prisma.adminPermission.findMany({
            where: {
              id: {
                in: body.permissionIds,
              },
            },
          })
        : Promise.resolve([]),
    ])

    if (!role) {
      throw new NotFoundException('角色不存在')
    }
    if (permissions.length !== body.permissionIds.length) {
      throw new NotFoundException('存在无效权限')
    }

    const traceId = randomUUID()
    await this.prisma.$transaction(async (tx) => {
      await tx.adminRolePermission.deleteMany({
        where: {
          roleId,
        },
      })

      if (body.permissionIds.length > 0) {
        await tx.adminRolePermission.createMany({
          data: body.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        })
      }

      await this.writeSecurityLogs(tx, {
        actor,
        action: 'security.role.assign-permissions',
        traceId,
        referenceType: 'ROLE_PERMISSION_ASSIGN',
        referenceId: roleId,
        payload: {
          roleId,
          permissionIds: body.permissionIds,
          permissionCodes: permissions.map((item) => item.code),
          result: '成功',
        } as Prisma.InputJsonValue,
      })
    })

    return {
      message: '角色权限分配成功',
      data: {
        traceId,
        roleId,
        permissionIds: body.permissionIds,
        permissionCodes: permissions.map((item) => item.code),
      },
    }
  }

  async createAdminUser(body: CreateAdminUserDto, actor: AdminActor) {
    await this.ensureSecurityBootstrap()

    const username = body.username.trim()
    const password = body.password.trim()
    const displayName = body.displayName.trim()

    if (!username) {
      throw new BadRequestException('管理员登录账号不能为空')
    }
    if (!password || password.length < 6) {
      throw new BadRequestException('管理员密码至少 6 位')
    }

    const [existingUser, role] = await Promise.all([
      this.prisma.adminUser.findUnique({
        where: {
          username,
        },
      }),
      this.prisma.adminRole.findUnique({
        where: {
          id: body.roleId,
        },
      }),
    ])

    if (existingUser) {
      throw new BadRequestException('管理员登录账号已存在')
    }
    if (!role) {
      throw new NotFoundException('管理员角色不存在')
    }

    const traceId = randomUUID()
    const created = await this.prisma.$transaction(async (tx) => {
      const adminUser = await tx.adminUser.create({
        data: {
          username,
          passwordHash: sha256(password),
          displayName: displayName || username,
          status: UserStatus.ACTIVE,
        },
      })

      await tx.adminUserRole.create({
        data: {
          adminUserId: adminUser.id,
          roleId: role.id,
        },
      })

      await this.writeSecurityLogs(tx, {
        actor,
        action: 'security.admin-user.create',
        traceId,
        referenceType: 'ADMIN_USER_CREATE',
        referenceId: adminUser.id,
        payload: {
          adminUserId: adminUser.id,
          username: adminUser.username,
          displayName: adminUser.displayName,
          roleId: role.id,
          roleCode: role.code,
          result: '成功',
        } as Prisma.InputJsonValue,
      })

      return {
        adminUser,
        role,
      }
    })

    return {
      message: '管理员新增成功',
      data: {
        traceId,
        adminUserId: created.adminUser.id,
        username: created.adminUser.username,
        displayName: created.adminUser.displayName,
        status: created.adminUser.status,
        roleId: created.role.id,
        roleCode: created.role.code,
        roleName: created.role.name,
      },
    }
  }

  private async ensureSecurityBootstrap() {
    await this.prisma.adminPermission.createMany({
      data: ADMIN_PERMISSION_DEFINITIONS.map((item, index) => ({
        id: `perm_seed_${index + 1}`,
        code: item.code,
        name: item.name,
        description: item.description,
      })),
      skipDuplicates: true,
    })

    const superAdminRole = await this.prisma.adminRole.upsert({
      where: {
        code: 'SUPER_ADMIN',
      },
      create: {
        id: 'role_super_admin',
        code: 'SUPER_ADMIN',
        name: '超级管理员',
        description: '默认拥有全部后台安全与治理权限',
      },
      update: {
        name: '超级管理员',
        description: '默认拥有全部后台安全与治理权限',
      },
    })

    const permissions = await this.prisma.adminPermission.findMany({
      select: {
        id: true,
      },
    })

    if (permissions.length > 0) {
      await this.prisma.adminRolePermission.createMany({
        data: permissions.map((item) => ({
          roleId: superAdminRole.id,
          permissionId: item.id,
        })),
        skipDuplicates: true,
      })
    }

    const adminsWithoutRoles = await this.prisma.adminUser.findMany({
      where: {
        roles: {
          none: {},
        },
      },
      select: {
        id: true,
      },
    })

    if (adminsWithoutRoles.length > 0) {
      await this.prisma.adminUserRole.createMany({
        data: adminsWithoutRoles.map((item) => ({
          adminUserId: item.id,
          roleId: superAdminRole.id,
        })),
        skipDuplicates: true,
      })
    }
  }

  private async writeSecurityLogs(
    tx: Prisma.TransactionClient,
    payload: {
      actor: AdminActor
      action: string
      traceId: string
      referenceType: string
      referenceId: string
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.adminOperationLog.create({
      data: {
        adminUserId: payload.actor.adminUserId,
        module: 'admin-auth',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: null,
        actorType: 'ADMIN',
        actorId: payload.actor.adminUserId,
        module: 'admin-auth',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })

    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(
          `${payload.referenceType}:${payload.referenceId}:${payload.traceId}:${JSON.stringify(payload.payload)}`,
        ),
        syncStatus: 'PENDING',
      },
    })
  }
}
