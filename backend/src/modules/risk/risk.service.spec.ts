import { describe, expect, it, jest } from '@jest/globals'
import { Prisma, UserStatus, WithdrawalStatus } from '@prisma/client'
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

  it('reads and writes structured risk rules', async () => {
    const ruleState = {
      id: 'rule-1',
      scope: 'default',
      withdrawInterceptEnabled: true,
      singleWithdrawalLimit: new Prisma.Decimal(50000),
      dailyWithdrawalLimit: new Prisma.Decimal(100000),
      abnormalTradeThreshold: new Prisma.Decimal(200000),
      updatedAt: new Date('2026-04-07T00:00:00.000Z'),
      blacklistItems: [{ uid: 'U0001001' }],
    }

    const tx = {
      riskRuleConfig: {
        upsert: jest.fn(async ({ create, update }: any) => {
          Object.assign(ruleState, ruleState.id ? update : create)
          return { ...ruleState }
        }),
        findUniqueOrThrow: jest.fn(async () => ({ ...ruleState })),
      },
      riskBlacklistUid: {
        deleteMany: jest.fn(async () => ({})),
        createMany: jest.fn(async ({ data }: any) => {
          ruleState.blacklistItems = data.map((item: any) => ({ uid: item.uid }))
          return { count: data.length }
        }),
      },
      adminOperationLog: { create: jest.fn(async () => ({})) },
      auditLog: { create: jest.fn(async () => ({})) },
      hashRecord: { create: jest.fn(async () => ({})) },
    }

    const prisma = {
      adminRole: { findMany: resolved([]) },
      user: { findMany: resolved([]) },
      withdrawalOrder: { findMany: resolved([]) },
      hashRecord: { findMany: resolved([]) },
      adminOperationLog: { findMany: resolved([]) },
      systemConfig: { findMany: resolved([]) },
      riskRuleConfig: {
        upsert: jest.fn(async () => ({ ...ruleState })),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any

    const service = new RiskService(prisma)
    const updated = await service.updateRules(
      {
        withdrawInterceptEnabled: false,
        singleWithdrawalLimit: 12000,
        dailyWithdrawalLimit: 50000,
        abnormalTradeThreshold: 90000,
        blacklistUids: ['U0002001', 'U0002002'],
      },
      {
        adminUserId: 'admin-1',
        username: 'risk-admin',
      },
    )

    expect(updated.data.withdrawInterceptEnabled).toBe(false)
    expect(updated.data.blacklistUids).toEqual(['U0002001', 'U0002002'])

    prisma.riskRuleConfig.upsert = jest.fn(async () => ({
      ...ruleState,
      withdrawInterceptEnabled: false,
      singleWithdrawalLimit: new Prisma.Decimal(12000),
      dailyWithdrawalLimit: new Prisma.Decimal(50000),
      abnormalTradeThreshold: new Prisma.Decimal(90000),
      updatedAt: new Date('2026-04-07T00:01:00.000Z'),
      blacklistItems: [{ uid: 'U0002001' }, { uid: 'U0002002' }],
    }))

    const result = await service.getRules()
    expect(result.withdrawInterceptEnabled).toBe(false)
    expect(result.blacklistUids).toEqual(['U0002001', 'U0002002'])
  })
})
