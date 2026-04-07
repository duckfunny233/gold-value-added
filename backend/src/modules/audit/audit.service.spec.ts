import { describe, expect, it, jest } from '@jest/globals'
import { sha256 } from '../../common/utils/hash.util'
import { AuditService } from './audit.service'

describe('AuditService admin audit', () => {
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)

  it('maps audit rows and detail items for trade events', async () => {
    const prisma = {
      auditLog: {
        findMany: resolved([
          {
            traceId: 'trace-1',
            module: 'trade',
            action: 'trade.match',
            actorType: 'SYSTEM',
            payload: { orderId: 'tr-1', before: '撮合前', after: '撮合后' },
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            user: { uid: 'U1' },
          },
        ]),
      },
      adminOperationLog: {
        findMany: resolved([]),
      },
      hashRecord: {
        findMany: resolved([
          {
            traceId: 'trace-1',
            referenceId: 'tr-1',
            sha256: 'abcdef1234567890',
            syncStatus: 'SYNCED',
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      },
    } as any

    const service = new AuditService(prisma)
    const result = await service.getAdminAudit({ eventType: 'trade' })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].module).toBe('交易管理')
    expect(result.detailItems[4].value).toBe('已写入半公开金链')
  })

  it('returns trace detail with nodes and hash items', async () => {
    const prisma = {
      auditLog: {
        findMany: resolved([
          {
            traceId: 'trace-export-1',
            module: 'fund',
            action: 'withdraw.create',
            actorType: 'USER',
            payload: { orderId: 'wd-1', username: 'alice' },
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            user: { uid: 'U1001' },
          },
        ]),
        create: resolved(undefined),
      },
      adminOperationLog: {
        findMany: resolved([
          {
            id: 'op-1',
            traceId: 'trace-export-1',
            module: 'fund',
            action: 'withdraw.approve',
            payload: { orderId: 'wd-1', result: '成功' },
            createdAt: new Date('2026-04-06T09:01:00.000Z'),
            adminUser: { username: 'admin', displayName: '管理员' },
          },
        ]),
        create: resolved(undefined),
      },
      hashRecord: {
        findMany: resolved([
          {
            traceId: 'trace-export-1',
            referenceType: 'WITHDRAWAL_ORDER_APPROVE',
            referenceId: 'wd-1',
            sha256: sha256('withdraw:wd-1:trace-export-1:approve'),
            syncStatus: 'SYNCED',
            createdAt: new Date('2026-04-06T09:02:00.000Z'),
            rechargeOrder: null,
            withdrawalOrder: { id: 'wd-1', amount: 88 },
            tradeOrder: null,
          },
        ]),
        create: resolved(undefined),
      },
      ledgerEntry: {
        findMany: resolved([
          {
            changeType: 'WITHDRAW_FREEZE',
            referenceType: 'WITHDRAWAL_ORDER',
            referenceId: 'wd-1',
            createdAt: new Date('2026-04-06T09:00:30.000Z'),
          },
        ]),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          adminOperationLog: { create: resolved(undefined) },
          auditLog: { create: resolved(undefined) },
          hashRecord: { create: resolved(undefined) },
        }),
      ),
    } as any

    const service = new AuditService(prisma)
    const result = await service.getTraceDetail('trace-export-1')

    expect(result.traceId).toBe('trace-export-1')
    expect(result.summary.totalNodes).toBe(4)
    expect(result.hashItems[0].syncStatus).toBe('SYNCED')
  })

  it('verifies trace hashes and reports pass result', async () => {
    const prisma = {
      auditLog: {
        findMany: resolved([
          {
            traceId: 'trace-verify-1',
            module: 'fund',
            action: 'withdraw.approve',
            actorType: 'ADMIN',
            actorId: 'admin-1',
            userId: 'user-1',
            payload: { orderId: 'wd-1', username: 'admin' },
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            user: { uid: 'U1001' },
          },
        ]),
        create: resolved(undefined),
      },
      adminOperationLog: {
        findMany: resolved([
          {
            id: 'op-1',
            adminUserId: 'admin-1',
            traceId: 'trace-verify-1',
            module: 'fund',
            action: 'withdraw.approve',
            payload: { orderId: 'wd-1', result: '成功' },
            createdAt: new Date('2026-04-06T09:00:10.000Z'),
            adminUser: { username: 'admin', displayName: '管理员' },
          },
        ]),
        create: resolved(undefined),
      },
      hashRecord: {
        findMany: resolved([
          {
            traceId: 'trace-verify-1',
            referenceType: 'WITHDRAWAL_ORDER_APPROVE',
            referenceId: 'wd-1',
            sha256: sha256('withdraw:wd-1:trace-verify-1:approve'),
            syncStatus: 'PENDING',
            createdAt: new Date('2026-04-06T09:00:20.000Z'),
            rechargeOrder: null,
            withdrawalOrder: { id: 'wd-1', amount: 88 },
            tradeOrder: null,
          },
        ]),
        create: resolved(undefined),
      },
      ledgerEntry: {
        findMany: resolved([]),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          adminOperationLog: { create: resolved(undefined) },
          auditLog: { create: resolved(undefined) },
          hashRecord: { create: resolved(undefined) },
        }),
      ),
    } as any

    const service = new AuditService(prisma)
    const result = await service.verifyTraceHash('trace-verify-1', { adminUserId: 'admin-1', username: 'admin' })

    expect(result.data.passed).toBe(true)
    expect(result.data.failedCount).toBe(0)
  })

  it('exports trace as csv', async () => {
    const prisma = {
      auditLog: {
        findMany: resolved([
          {
            traceId: 'trace-csv-1',
            module: 'trade',
            action: 'trade.submit.buy',
            actorType: 'USER',
            payload: { orderId: 'tr-1', username: 'alice' },
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            user: { uid: 'U1001' },
          },
        ]),
        create: resolved(undefined),
      },
      adminOperationLog: {
        findMany: resolved([]),
        create: resolved(undefined),
      },
      hashRecord: {
        findMany: resolved([
          {
            traceId: 'trace-csv-1',
            referenceType: 'TRADE_ORDER',
            referenceId: 'tr-1',
            sha256: sha256('trade:tr-1:trace-csv-1:BUY:560:1'),
            syncStatus: 'PENDING',
            createdAt: new Date('2026-04-06T09:00:20.000Z'),
            rechargeOrder: null,
            withdrawalOrder: null,
            tradeOrder: {
              id: 'tr-1',
              side: 'BUY',
              price: 560,
              quantityGrams: 1,
            },
          },
        ]),
        create: resolved(undefined),
      },
      ledgerEntry: {
        findMany: resolved([]),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          adminOperationLog: { create: resolved(undefined) },
          auditLog: { create: resolved(undefined) },
          hashRecord: { create: resolved(undefined) },
        }),
      ),
    } as any

    const service = new AuditService(prisma)
    const result = await service.exportTrace('trace-csv-1', { format: 'csv' }, { adminUserId: 'admin-1', username: 'admin' })

    expect(result.data.fileName).toBe('audit-trace-trace-csv-1.csv')
    expect(result.data.content).toContain('traceId,nodeType,module')
  })
})
