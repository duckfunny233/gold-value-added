import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import { PaymentService } from './payment.service'

describe('PaymentService appreciation payment V1', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)
  const fn = () => jest.fn() as any

  const createService = () => {
    const tx = {
      user: {
        findFirst: fn(),
        findUnique: fn(),
      },
      asset: {
        updateMany: fn(),
        update: fn(),
        findUnique: fn(),
      },
      paymentOrder: {
        create: fn(),
        findMany: fn(),
      },
      paymentProfile: {
        upsert: fn(),
      },
      ledgerEntry: {
        create: fn(),
      },
      auditLog: {
        create: fn(),
      },
      hashRecord: {
        create: fn(),
      },
    }

    const prisma = {
      user: {
        findFirst: fn(),
        findUnique: fn(),
      },
      paymentProfile: {
        upsert: fn(),
      },
      paymentOrder: {
        findMany: fn(),
      },
      auditLog: {
        create: fn(),
      },
      hashRecord: {
        create: fn(),
      },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(tx as any)
        }
        return callback
      }),
    } as any

    const operationIdempotencyService = {
      reserve: jest.fn(async (_scope: string, key: string, _request: unknown, traceId: string) => ({
        mode: 'execute',
        id: `idem-${key}`,
        key,
        requestHash: 'hash',
        traceId,
      })),
      markSucceeded: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
    } as any

    return {
      service: new PaymentService(prisma, operationIdempotencyService),
      prisma,
      tx,
      operationIdempotencyService,
    }
  }

  it('uses appreciation income only for payment', async () => {
    const { service, tx } = createService()
    tx.user.findFirst = resolved({
      id: 'payer-1',
      uid: 'U1001',
      username: 'alice',
      asset: {
        id: 'asset-payer',
        appreciationIncome: decimal(200),
        cashAsset: decimal(1000),
        tentativeAsset: decimal(1000),
        totalAsset: decimal(1500),
      },
    })
    tx.user.findUnique = resolved({
      id: 'payee-1',
      uid: 'U1002',
      username: 'bob',
      asset: {
        id: 'asset-payee',
        appreciationIncome: decimal(50),
        cashAsset: decimal(300),
        tentativeAsset: decimal(300),
        totalAsset: decimal(350),
      },
    })
    tx.asset.updateMany = resolved({ count: 1 })
    tx.asset.update = resolved(undefined)
    ;(tx.asset.findUnique as any)
      .mockResolvedValueOnce({
        id: 'asset-payer',
        appreciationIncome: decimal(120),
        totalAsset: decimal(1420),
      })
      .mockResolvedValueOnce({
        id: 'asset-payee',
        appreciationIncome: decimal(130),
        totalAsset: decimal(430),
      })
    tx.paymentOrder.create = resolved({
      id: 'pay-1',
      traceId: 'trace-pay-1',
      status: 'COMPLETED',
      scene: 'USER',
    })

    await service.transfer({
      payerUid: 'U1001',
      payeeUid: 'U1002',
      amount: 80,
      scene: 'user',
      remark: 'test',
    })

    expect((tx.asset.updateMany as any).mock.calls[0][0].data).toEqual({
      appreciationIncome: { decrement: decimal(80) },
      totalAsset: { decrement: decimal(80) },
    })
    expect((tx.asset.update as any).mock.calls[0][0].data).toEqual({
      appreciationIncome: { increment: decimal(80) },
      totalAsset: { increment: decimal(80) },
    })
  })

  it('blocks payment when appreciation income is insufficient', async () => {
    const { service, tx } = createService()
    tx.user.findFirst = resolved({
      id: 'payer-1',
      uid: 'U1001',
      username: 'alice',
      asset: {
        id: 'asset-payer',
        appreciationIncome: decimal(20),
        cashAsset: decimal(1000),
        tentativeAsset: decimal(1000),
        totalAsset: decimal(1020),
      },
    })
    tx.user.findUnique = resolved({
      id: 'payee-1',
      uid: 'U1002',
      username: 'bob',
      asset: {
        id: 'asset-payee',
        appreciationIncome: decimal(50),
        cashAsset: decimal(300),
        tentativeAsset: decimal(300),
        totalAsset: decimal(350),
      },
    })
    tx.asset.updateMany = resolved({ count: 0 })

    await expect(
      service.transfer({
        payerUid: 'U1001',
        payeeUid: 'U1002',
        amount: 80,
        scene: 'user',
        remark: 'test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('does not duplicate deduction on idempotent replay', async () => {
    const { service, tx, prisma, operationIdempotencyService } = createService()
    tx.user.findFirst = resolved({
      id: 'payer-1',
      uid: 'U1001',
      username: 'alice',
      asset: {
        id: 'asset-payer',
        appreciationIncome: decimal(200),
        cashAsset: decimal(1000),
        tentativeAsset: decimal(1000),
        totalAsset: decimal(1500),
      },
    })
    prisma.user.findFirst = resolved({
      id: 'payer-1',
      uid: 'U1001',
      username: 'alice',
      asset: {
        id: 'asset-payer',
        appreciationIncome: decimal(200),
        cashAsset: decimal(1000),
        tentativeAsset: decimal(1000),
        totalAsset: decimal(1500),
      },
    })
    tx.user.findUnique = resolved({
      id: 'payee-1',
      uid: 'U1002',
      username: 'bob',
      asset: {
        id: 'asset-payee',
        appreciationIncome: decimal(50),
        cashAsset: decimal(300),
        tentativeAsset: decimal(300),
        totalAsset: decimal(350),
      },
    })
    tx.asset.updateMany = resolved({ count: 1 })
    tx.asset.update = resolved(undefined)
    ;(tx.asset.findUnique as any)
      .mockResolvedValueOnce({
        id: 'asset-payer',
        appreciationIncome: decimal(120),
        totalAsset: decimal(1420),
      })
      .mockResolvedValueOnce({
        id: 'asset-payee',
        appreciationIncome: decimal(130),
        totalAsset: decimal(430),
      })
    tx.paymentOrder.create = resolved({
      id: 'pay-1',
      traceId: 'trace-pay-1',
      status: 'COMPLETED',
      scene: 'USER',
    })
    ;(operationIdempotencyService.reserve as any)
      .mockResolvedValueOnce({
        mode: 'execute',
        id: 'idem-pay-1',
        key: 'pay-key',
        requestHash: 'hash',
        traceId: 'trace-pay-1',
      })
      .mockResolvedValueOnce({
        mode: 'replay',
        id: 'idem-pay-1',
        key: 'pay-key',
        requestHash: 'hash',
        traceId: 'trace-pay-1',
        responsePayload: {
          message: '支付已完成',
          data: {
            orderId: 'pay-1',
            traceId: 'trace-pay-1',
            payerUid: 'U1001',
            payeeUid: 'U1002',
            amount: 80,
            scene: 'user',
            status: 'completed',
          },
        },
      })

    const first = await service.transfer({
      payerUid: 'U1001',
      payeeUid: 'U1002',
      amount: 80,
      scene: 'user',
      remark: 'test',
      clientRequestId: 'pay-key',
    }, 'pay-key') as any
    const second = await service.transfer({
      payerUid: 'U1001',
      payeeUid: 'U1002',
      amount: 80,
      scene: 'user',
      remark: 'test',
      clientRequestId: 'pay-key',
    }, 'pay-key') as any

    expect(first.data.orderId).toBe('pay-1')
    expect(second.data.orderId).toBe('pay-1')
    expect(tx.paymentOrder.create).toHaveBeenCalledTimes(1)
    expect(tx.asset.updateMany).toHaveBeenCalledTimes(1)
  })

  it('updates payer and payee appreciation balances correctly', async () => {
    const { service, tx } = createService()
    tx.user.findFirst = resolved({
      id: 'payer-1',
      uid: 'U1001',
      username: 'alice',
      asset: {
        id: 'asset-payer',
        appreciationIncome: decimal(500),
        cashAsset: decimal(1000),
        tentativeAsset: decimal(900),
        totalAsset: decimal(1600),
      },
    })
    tx.user.findUnique = resolved({
      id: 'payee-1',
      uid: 'U1002',
      username: 'merchant-a',
      asset: {
        id: 'asset-payee',
        appreciationIncome: decimal(100),
        cashAsset: decimal(300),
        tentativeAsset: decimal(300),
        totalAsset: decimal(400),
      },
    })
    tx.asset.updateMany = resolved({ count: 1 })
    tx.asset.update = resolved(undefined)
    ;(tx.asset.findUnique as any)
      .mockResolvedValueOnce({
        id: 'asset-payer',
        appreciationIncome: decimal(380),
        totalAsset: decimal(1480),
      })
      .mockResolvedValueOnce({
        id: 'asset-payee',
        appreciationIncome: decimal(220),
        totalAsset: decimal(520),
      })
    tx.paymentOrder.create = resolved({
      id: 'pay-2',
      traceId: 'trace-pay-2',
      status: 'COMPLETED',
      scene: 'MERCHANT',
    })

    const result = await service.transfer({
      payerUsername: 'alice',
      payeeUid: 'U1002',
      amount: 120,
      scene: 'merchant',
      remark: 'merchant pay',
    }) as any

    expect(result.data.payerBalance.appreciationIncome).toBe(380)
    expect(result.data.payerBalance.totalAsset).toBe(1480)
    expect(result.data.payeeBalance.appreciationIncome).toBe(220)
    expect(result.data.payeeBalance.totalAsset).toBe(520)
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(2)
  })
})
