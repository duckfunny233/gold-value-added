import { ConflictException } from '@nestjs/common'
import { describe, expect, it, jest } from '@jest/globals'
import { Prisma, RechargeStatus, WithdrawalStatus } from '@prisma/client'
import { FundService } from './fund.service'

describe('FundService concurrency safety V1', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)
  const fn = () => jest.fn() as any

  const createService = () => {
    const tx = {
      rechargeOrder: { create: fn() },
      withdrawalOrder: {
        create: fn(),
        findUnique: fn(),
        findMany: fn(),
        updateMany: fn(),
      },
      asset: {
        findUnique: fn(),
        update: fn(),
        updateMany: fn(),
      },
      ledgerEntry: { create: fn() },
      hashRecord: { create: fn() },
      auditLog: { create: fn(), findMany: fn() },
      adminOperationLog: { create: fn() },
    }

    const prisma = {
      user: { findUnique: fn(), findFirst: fn() },
      rechargeOrder: { findMany: fn() },
      withdrawalOrder: { findMany: fn(), count: fn() },
      ledgerEntry: { findMany: fn() },
      auditLog: { findMany: fn(), create: fn() },
      adminOperationLog: { create: fn() },
      hashRecord: { create: fn() },
      asset: { findMany: fn() },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(tx as any)
        }
        return callback
      }),
    } as any

    const operationIdempotencyService = {
      createRequestHash: jest.fn((payload: unknown) => JSON.stringify(payload)),
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
      service: new FundService(prisma, operationIdempotencyService),
      prisma,
      tx,
      operationIdempotencyService,
    }
  }

  it('auto credits recharge and updates assets within transaction', async () => {
    const { service, prisma, tx } = createService()
    prisma.user.findUnique = resolved({
      id: 'user-1',
      username: 'alice',
      asset: {
        id: 'asset-1',
        tentativeAsset: decimal(100),
        cashAsset: decimal(50),
        totalAsset: decimal(150),
        withdrawFrozenAmount: decimal(0),
      },
    })
    tx.asset.update = resolved({
      id: 'asset-1',
      tentativeAsset: decimal(200),
      cashAsset: decimal(150),
      totalAsset: decimal(250),
      withdrawFrozenAmount: decimal(0),
    })
    tx.rechargeOrder.create = resolved({
      id: 're-1',
      status: RechargeStatus.COMPLETED,
    })

    const result = await service.createRecharge({
      username: 'alice',
      channel: 'wechat',
      amount: 100,
    })

    expect(result.data.latestBalance.totalAsset).toBe(250)
  })

  it('queueNo stays unique and grows under concurrent withdrawals', async () => {
    const { service, prisma, tx } = createService()
    prisma.user.findUnique = resolved({
      id: 'user-1',
      username: 'alice',
      asset: {
        id: 'asset-1',
        tentativeAsset: decimal(500),
        cashAsset: decimal(100),
        totalAsset: decimal(600),
        withdrawFrozenAmount: decimal(0),
      },
    })
    tx.asset.updateMany = resolved({ count: 1 })
    tx.asset.findUnique = resolved({
      id: 'asset-1',
      tentativeAsset: decimal(380),
      cashAsset: decimal(100),
      totalAsset: decimal(480),
      withdrawFrozenAmount: decimal(120),
    })

    let queueNo = 0
    tx.withdrawalOrder.create = jest.fn(async () => {
      queueNo += 1
      return {
        id: `wd-${queueNo}`,
        status: WithdrawalStatus.PENDING,
        queueNo,
      }
    })

    const [first, second] = await Promise.all([
      service.createWithdrawal({ username: 'alice', amount: 120, bankName: '建行' }),
      service.createWithdrawal({ username: 'alice', amount: 120, bankName: '建行' }),
    ])

    expect(first.data.queueNo).toBe(1)
    expect(second.data.queueNo).toBe(2)
    expect(new Set([first.data.queueNo, second.data.queueNo]).size).toBe(2)
  })

  it('concurrent approve only succeeds once', async () => {
    const { service, tx, operationIdempotencyService } = createService()
    ;(operationIdempotencyService.reserve as any)
      .mockResolvedValueOnce({
        mode: 'execute',
        id: 'idem-1',
        key: 'approve',
        requestHash: 'hash',
        traceId: 'trace-approve',
      })
      .mockResolvedValueOnce({
        mode: 'conflict',
        id: 'idem-1',
        key: 'approve',
        requestHash: 'hash',
        traceId: 'trace-approve',
      })

    tx.withdrawalOrder.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'wd-1',
        userId: 'user-1',
        amount: decimal(100),
        status: WithdrawalStatus.PENDING,
        traceId: 'trace-order',
        isVoiceMuted: false,
      })
      .mockResolvedValueOnce({
        id: 'wd-1',
        userId: 'user-1',
        amount: decimal(100),
        status: WithdrawalStatus.REVIEWING,
        traceId: 'trace-order',
        isVoiceMuted: false,
      })
    tx.asset.findUnique = resolved({
      id: 'asset-1',
      withdrawFrozenAmount: decimal(100),
    })
    tx.withdrawalOrder.updateMany = resolved({ count: 1 })

    const first = service.approveWithdrawal('wd-1', { adminUserId: 'admin-1', username: 'admin' })
    const second = service.approveWithdrawal('wd-1', { adminUserId: 'admin-1', username: 'admin' })

    await expect(first).resolves.toEqual(
      expect.objectContaining({
        orderId: 'wd-1',
        status: 'transfer_processing',
      }),
    )
    await expect(second).rejects.toBeInstanceOf(ConflictException)
  })

  it('concurrent reject only succeeds once', async () => {
    const { service, tx, operationIdempotencyService } = createService()
    ;(operationIdempotencyService.reserve as any)
      .mockResolvedValueOnce({
        mode: 'execute',
        id: 'idem-reject',
        key: 'reject',
        requestHash: 'hash',
        traceId: 'trace-reject',
      })
      .mockResolvedValueOnce({
        mode: 'conflict',
        id: 'idem-reject',
        key: 'reject',
        requestHash: 'hash',
        traceId: 'trace-reject',
      })

    tx.withdrawalOrder.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'wd-3',
        userId: 'user-3',
        amount: decimal(60),
        status: WithdrawalStatus.PENDING,
        traceId: 'trace-order',
        isVoiceMuted: false,
      })
      .mockResolvedValueOnce({
        id: 'wd-3',
        userId: 'user-3',
        amount: decimal(60),
        status: WithdrawalStatus.REJECTED,
        traceId: 'trace-order',
        isVoiceMuted: true,
      })
    tx.asset.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'asset-3',
        withdrawFrozenAmount: decimal(60),
      })
      .mockResolvedValueOnce({
        id: 'asset-3',
        totalAsset: decimal(600),
      })
    tx.withdrawalOrder.updateMany = resolved({ count: 1 })
    tx.asset.updateMany = resolved({ count: 1 })

    const first = service.rejectWithdrawal('wd-3', { adminUserId: 'admin-1', username: 'admin' })
    const second = service.rejectWithdrawal('wd-3', { adminUserId: 'admin-1', username: 'admin' })

    await expect(first).resolves.toEqual(
      expect.objectContaining({
        orderId: 'wd-3',
        status: 'rejected',
      }),
    )
    await expect(second).rejects.toBeInstanceOf(ConflictException)
  })

  it('confirm-completed does not double deduct tentative or total asset', async () => {
    const { service, tx, operationIdempotencyService } = createService()
    ;(operationIdempotencyService.reserve as any).mockResolvedValue({
      mode: 'execute',
      id: 'idem-confirm',
      key: 'confirm',
      requestHash: 'hash',
      traceId: 'trace-confirm',
    })
    tx.withdrawalOrder.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'wd-2',
        userId: 'user-2',
        amount: decimal(88),
        status: WithdrawalStatus.REVIEWING,
        traceId: 'trace-order',
        isVoiceMuted: false,
      })
      .mockResolvedValueOnce({
        id: 'wd-2',
        amount: decimal(88),
        status: WithdrawalStatus.COMPLETED,
        traceId: 'trace-order',
        isVoiceMuted: true,
      })
    tx.asset.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'asset-2',
        withdrawFrozenAmount: decimal(88),
      })
      .mockResolvedValueOnce({
        id: 'asset-2',
        totalAsset: decimal(900),
      })
    tx.withdrawalOrder.updateMany = resolved({ count: 1 })
    tx.asset.updateMany = resolved({ count: 1 })

    await service.confirmWithdrawalCompleted('wd-2', { adminUserId: 'admin-1', username: 'admin' })

    expect((tx.asset.updateMany as any).mock.calls[0][0].data.withdrawFrozenAmount).toEqual({
      decrement: decimal(88),
    })
    expect((tx.asset.updateMany as any).mock.calls[0][0].data.tentativeAsset).toBeUndefined()
    expect((tx.asset.updateMany as any).mock.calls[0][0].data.totalAsset).toBeUndefined()
  })

  it('concurrent confirm only succeeds once', async () => {
    const { service, tx, operationIdempotencyService } = createService()
    ;(operationIdempotencyService.reserve as any)
      .mockResolvedValueOnce({
        mode: 'execute',
        id: 'idem-confirm-concurrent',
        key: 'confirm',
        requestHash: 'hash',
        traceId: 'trace-confirm-concurrent',
      })
      .mockResolvedValueOnce({
        mode: 'conflict',
        id: 'idem-confirm-concurrent',
        key: 'confirm',
        requestHash: 'hash',
        traceId: 'trace-confirm-concurrent',
      })
    tx.withdrawalOrder.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'wd-4',
        userId: 'user-4',
        amount: decimal(40),
        status: WithdrawalStatus.REVIEWING,
        traceId: 'trace-order',
        isVoiceMuted: false,
      })
      .mockResolvedValueOnce({
        id: 'wd-4',
        amount: decimal(40),
        status: WithdrawalStatus.COMPLETED,
        traceId: 'trace-order',
        isVoiceMuted: true,
      })
    tx.asset.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'asset-4',
        withdrawFrozenAmount: decimal(40),
      })
      .mockResolvedValueOnce({
        id: 'asset-4',
        totalAsset: decimal(400),
      })
    tx.withdrawalOrder.updateMany = resolved({ count: 1 })
    tx.asset.updateMany = resolved({ count: 1 })

    const first = service.confirmWithdrawalCompleted('wd-4', { adminUserId: 'admin-1', username: 'admin' })
    const second = service.confirmWithdrawalCompleted('wd-4', { adminUserId: 'admin-1', username: 'admin' })

    await expect(first).resolves.toEqual(
      expect.objectContaining({
        orderId: 'wd-4',
        status: 'completed',
      }),
    )
    await expect(second).rejects.toBeInstanceOf(ConflictException)
  })

  it('concurrent manual-transfer does not duplicate ledger posting', async () => {
    const { service, prisma, tx, operationIdempotencyService } = createService()
    prisma.user.findUnique = resolved({
      id: 'user-1',
      uid: 'U1001',
      username: 'alice',
      asset: {
        id: 'asset-1',
        tentativeAsset: decimal(100),
        cashAsset: decimal(50),
        totalAsset: decimal(150),
        withdrawFrozenAmount: decimal(0),
      },
    })
    ;(operationIdempotencyService.reserve as any)
      .mockResolvedValueOnce({
        mode: 'execute',
        id: 'idem-manual',
        key: 'manual',
        requestHash: 'hash',
        traceId: 'trace-manual',
      })
      .mockResolvedValueOnce({
        mode: 'conflict',
        id: 'idem-manual',
        key: 'manual',
        requestHash: 'hash',
        traceId: 'trace-manual',
      })
    tx.asset.updateMany = resolved({ count: 1 })
    tx.asset.findUnique = resolved({
      id: 'asset-1',
      tentativeAsset: decimal(220),
      cashAsset: decimal(50),
      totalAsset: decimal(270),
      withdrawFrozenAmount: decimal(0),
    })

    const body = {
      uid: 'U1001',
      amount: 120,
      direction: 'increase' as const,
      reason: '人工补录',
    }

    const first = service.manualTransfer(body, { adminUserId: 'admin-1', username: 'owner' }, 'same-key')
    const second = service.manualTransfer(body, { adminUserId: 'admin-1', username: 'owner' }, 'same-key')

    await expect(first).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          uid: 'U1001',
        }),
      }),
    )
    await expect(second).rejects.toBeInstanceOf(ConflictException)
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(1)
  })
})
