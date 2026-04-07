import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, jest } from '@jest/globals'
import { UserStatus } from '@prisma/client'
import { AdminPermissionGuard } from './admin-permission.guard'

describe('AdminPermissionGuard', () => {
  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext

  it('rejects request when admin lacks permission', async () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => ['risk.user.freeze']),
    } as unknown as Reflector
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({
          id: 'admin-1',
          username: 'admin',
          status: UserStatus.ACTIVE,
          roles: [],
        })),
      },
    } as any

    const guard = new AdminPermissionGuard(reflector, prisma)
    const request = {
      user: {
        adminUserId: 'admin-1',
        username: 'admin',
        permissionCodes: ['token-stale'],
      },
    }

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('uses database permissions instead of stale token claims', async () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => ['risk.user.freeze']),
    } as unknown as Reflector
    const prisma = {
      adminUser: {
        findUnique: jest.fn(async () => ({
          id: 'admin-1',
          username: 'admin',
          status: UserStatus.ACTIVE,
          roles: [
            {
              role: {
                code: 'SUPER_ADMIN',
                permissions: [
                  {
                    permission: {
                      code: 'risk.user.freeze',
                    },
                  },
                ],
              },
            },
          ],
        })),
      },
    } as any

    const guard = new AdminPermissionGuard(reflector, prisma)
    const request = {
      user: {
        adminUserId: 'admin-1',
        username: 'admin',
        permissionCodes: ['token.old.permission'],
      },
    }

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true)
    expect(request.user.permissionCodes).toEqual(['risk.user.freeze'])
  })
})
