import { describe, expect, it, jest } from '@jest/globals'
import { Prisma, TradeStatus, WithdrawalStatus } from '@prisma/client'
import { ReportService } from './report.service'

describe('ReportService admin reports', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)

  it('aggregates cards and exports for finance reports', async () => {
    const prisma = {
      user: { findMany: resolved([]) },
      tradeOrder: {
        findMany: resolved([
          {
            price: decimal(560),
            quantityGrams: decimal(2),
            status: TradeStatus.FILLED,
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      },
      rechargeOrder: {
        findMany: resolved([
          {
            amount: decimal(1000),
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      },
      withdrawalOrder: {
        findMany: resolved([
          {
            amount: decimal(200),
            status: WithdrawalStatus.PENDING,
            createdAt: new Date('2026-04-06T10:00:00.000Z'),
          },
        ]),
      },
      hashRecord: {
        findMany: resolved([
          {
            syncStatus: 'PENDING',
            createdAt: new Date('2026-04-06T11:00:00.000Z'),
          },
        ]),
      },
      adminOperationLog: {
        findMany: resolved([]),
      },
    } as any

    const service = new ReportService(prisma)
    const result = await service.getAdminReports({ reportType: 'finance', timeRange: '7d' })

    expect(result.cards[2].value).toBe('¥1,120.00')
    expect(result.exportsList[0].name).toBe('财务日报')
  })
})
