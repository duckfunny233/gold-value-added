import { describe, expect, it, jest } from '@jest/globals'
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
})
