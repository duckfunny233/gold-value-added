import { describe, expect, it, jest } from '@jest/globals'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import { sha256 } from '../../common/utils/hash.util'
import { AdminAuthService } from './admin-auth.service'

describe('AdminAuthService', () => {
  const adminRow = {
    id: 'admin-1',
    username: 'admin',
    passwordHash: sha256('123456'),
    displayName: '系统管理员',
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    roles: [
      {
        role: {
          code: 'SUPER_ADMIN',
          name: '超级管理员',
          permissions: [
            {
              permission: { code: 'security.read' },
            },
          ],
        },
      },
    ],
  }

  const createService = (overrides: Record<string, unknown> = {}) => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => adminRow),
        update: jest.fn(async () => adminRow),
      },
      adminOperationLog: {
        create: jest.fn(async () => ({ id: 'log-1' })),
      },
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<void>) => callback(prisma)),
      ...overrides,
    }
    const jwtService = {
      signAsync: jest.fn(async () => 'jwt-token'),
    }

    return {
      service: new AdminAuthService(prisma as any, jwtService as any),
      prisma,
      jwtService,
    }
  }

  it('returns token and adminUser on successful login', async () => {
    const { service, jwtService } = createService()
    const result = await service.login({ username: 'admin', password: '123456' })

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'admin-1',
        username: 'admin',
        roleCodes: ['SUPER_ADMIN'],
        permissionCodes: ['security.read'],
      }),
    )
    expect(result.data.token).toBe('jwt-token')
    expect(result.data.adminUser).toEqual({
      username: 'admin',
      displayName: '系统管理员',
      roleCodes: ['SUPER_ADMIN'],
      permissionCodes: ['security.read'],
    })
  })

  it('throws 404 when admin does not exist', async () => {
    const { service } = createService({
      adminUser: {
        findUnique: jest.fn(async () => null),
      },
    })

    await expect(service.login({ username: 'ghost', password: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('throws 401 when password is wrong', async () => {
    const { service } = createService()

    await expect(service.login({ username: 'admin', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('throws 401 when admin is not active', async () => {
    const { service } = createService({
      adminUser: {
        findUnique: jest.fn(async () => ({
          ...adminRow,
          status: UserStatus.DISABLED,
        })),
      },
    })

    await expect(service.login({ username: 'admin', password: '123456' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('returns profile with roles and permissions', async () => {
    const { service } = createService()
    const result = await service.getProfile({}, 'admin')

    expect(result.data).toMatchObject({
      username: 'admin',
      displayName: '系统管理员',
      status: UserStatus.ACTIVE,
      roles: [{ code: 'SUPER_ADMIN', name: '超级管理员' }],
      permissions: ['security.read'],
    })
  })
})
