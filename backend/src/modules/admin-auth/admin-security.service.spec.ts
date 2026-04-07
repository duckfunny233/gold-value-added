import { describe, expect, it, jest } from '@jest/globals'
import { AdminSecurityService } from './admin-security.service'

describe('AdminSecurityService', () => {
  it('assigns roles with overwrite semantics', async () => {
    const tx = {
      adminUserRole: {
        deleteMany: jest.fn(async () => ({})),
        createMany: jest.fn(async () => ({ count: 2 })),
      },
      adminOperationLog: {
        create: jest.fn(async () => ({})),
      },
      auditLog: {
        create: jest.fn(async () => ({})),
      },
      hashRecord: {
        create: jest.fn(async () => ({})),
      },
    }

    const prisma = {
      adminPermission: {
        count: jest.fn(async () => 1),
      },
      adminUser: {
        findUnique: jest.fn(async () => ({
          id: 'admin-target',
          username: 'operator',
        })),
      },
      adminRole: {
        findMany: jest.fn(async () => [
          { id: 'role-1', code: 'SUPER_ADMIN' },
          { id: 'role-2', code: 'RISK_ADMIN' },
        ]),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any

    const service = new AdminSecurityService(prisma)
    const result = await service.assignAdminUserRoles(
      'admin-target',
      { roleIds: ['role-1', 'role-2'] },
      { adminUserId: 'admin-1', username: 'owner' },
    )

    expect(tx.adminUserRole.deleteMany).toHaveBeenCalledWith({
      where: {
        adminUserId: 'admin-target',
      },
    })
    expect(tx.adminUserRole.createMany).toHaveBeenCalledWith({
      data: [
        { adminUserId: 'admin-target', roleId: 'role-1' },
        { adminUserId: 'admin-target', roleId: 'role-2' },
      ],
    })
    expect(result.data.roleCodes).toEqual(['SUPER_ADMIN', 'RISK_ADMIN'])
  })
})
