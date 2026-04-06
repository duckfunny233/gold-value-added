import { describe, expect, it, jest } from '@jest/globals'
import { UserStatus, WithdrawalStatus } from '@prisma/client'
import { RiskService } from './risk.service'

describe('RiskService admin risk', () => {
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)

  it('filters risk rows by warning level and risk type', async () => {
    const prisma = {
      adminRole: { findMany: resolved([]) },
      user: {
        findMany: resolved([
          {
            uid: 'U1',
            username: 'u1',
            nickname: '用户1',
            status: UserStatus.FROZEN,
            updatedAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      },
      withdrawalOrder: {
        findMany: resolved([
          {
            status: WithdrawalStatus.REVIEWING,
            reviewerId: null,
            submittedAt: new Date('2026-04-06T10:00:00.000Z'),
            user: { uid: 'U2', username: 'u2', nickname: '用户2', status: UserStatus.ACTIVE },
          },
        ]),
      },
      hashRecord: { findMany: resolved([]) },
      adminOperationLog: { findMany: resolved([]) },
      systemConfig: { findMany: resolved([]) },
    } as any

    const service = new RiskService(prisma)
    const result = await service.getAdminRisk({ riskType: 'withdraw', warningLevel: 'medium' })

    expect(result.riskRows).toHaveLength(1)
    expect(result.riskRows[0].uid).toBe('U2')
    expect(result.riskRows[0].riskType).toBe('提现拦截')
  })
})
