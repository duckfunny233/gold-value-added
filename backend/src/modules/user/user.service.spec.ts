import { describe, expect, it, jest } from '@jest/globals'
import { Prisma, RealNameStatus, RechargeStatus, UserStatus, WithdrawalStatus } from '@prisma/client'
import { UserService } from './user.service'

describe('UserService admin users', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)

  it('filters users by computed sequenceNo and returns selected user details', async () => {
    const prisma = {
      user: {
        findMany: resolved([
          {
            id: 'user-1',
            uid: 'U0001',
            username: 'alice',
            nickname: '金影子A',
            status: UserStatus.ACTIVE,
            realNameStatus: RealNameStatus.VERIFIED,
            createdAt: new Date('2026-04-01T08:00:00.000Z'),
            asset: {
              cashAsset: decimal(1200),
              goldHoldingGrams: decimal(2.5),
              totalAsset: decimal(1600),
              tentativeAsset: decimal(1200),
              withdrawFrozenAmount: decimal(0),
              appreciationIncome: decimal(400),
            },
          },
          {
            id: 'user-2',
            uid: 'U0002',
            username: 'bob',
            nickname: '金影子B',
            status: UserStatus.FROZEN,
            realNameStatus: RealNameStatus.PENDING,
            createdAt: new Date('2026-04-02T08:00:00.000Z'),
            asset: {
              cashAsset: decimal(800),
              goldHoldingGrams: decimal(0),
              totalAsset: decimal(800),
              tentativeAsset: decimal(0),
              withdrawFrozenAmount: decimal(0),
              appreciationIncome: decimal(0),
            },
          },
        ]),
      },
      rechargeOrder: {
        findMany: resolved([
          {
            id: 're-1',
            userId: 'user-2',
            status: RechargeStatus.COMPLETED,
            traceId: 'trace-re-1',
            createdAt: new Date('2026-04-03T08:00:00.000Z'),
          },
        ]),
      },
      withdrawalOrder: {
        findMany: resolved([
          {
            id: 'wd-1',
            userId: 'user-2',
            status: WithdrawalStatus.PENDING,
            traceId: 'trace-wd-1',
            submittedAt: new Date('2026-04-04T08:00:00.000Z'),
            bankName: '建行',
            bankAccountNo: '62170001',
            alipayReceiptUrl: null,
            wechatReceiptUrl: null,
          },
        ]),
      },
      tradeOrder: {
        findMany: resolved([
          {
            id: 'tr-1',
            userId: 'user-2',
            side: 'BUY',
            status: 'OPEN',
            traceId: 'trace-tr-1',
            submittedAt: new Date('2026-04-05T08:00:00.000Z'),
          },
        ]),
      },
      auditLog: {
        findMany: resolved([
          {
            id: 'audit-1',
            userId: 'user-2',
            module: 'fund',
            action: 'withdraw.create',
            traceId: 'trace-wd-1',
            createdAt: new Date('2026-04-05T08:05:00.000Z'),
          },
        ]),
      },
      hashRecord: {
        findMany: resolved([]),
      },
    } as any

    const service = new UserService(prisma)
    const result = await service.getAdminUsers({ sequenceNo: 'S00000002' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].uid).toBe('U0002')
    expect(result.selectedUser.uid).toBe('U0002')
    expect(result.relatedRecords.withdraw[0]).toContain('提现单 wd-1')
  })
})
