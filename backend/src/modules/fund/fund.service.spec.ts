import { describe, expect, it, jest } from '@jest/globals'
import { AssetChangeType, Prisma, RechargeStatus, WithdrawalStatus } from '@prisma/client'
import { FundService } from './fund.service'

describe('FundService V1', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)
  const fn = () => jest.fn() as any

  const createService = () => {
    const tx = {
      rechargeOrder: {
        create: fn(),
      },
      withdrawalOrder: {
        create: fn(),
        findUnique: fn(),
        findFirst: fn(),
        update: fn(),
      },
      asset: {
        findUnique: fn(),
        update: fn(),
      },
      ledgerEntry: {
        create: fn(),
      },
      hashRecord: {
        create: fn(),
      },
      auditLog: {
        create: fn(),
        findMany: fn(),
      },
    }

    const prisma = {
      user: {
        findUnique: fn(),
        findFirst: fn(),
      },
      rechargeOrder: {
        findMany: fn(),
      },
      withdrawalOrder: {
        count: fn(),
        findMany: fn(),
      },
      ledgerEntry: {
        findMany: fn(),
      },
      auditLog: {
        findMany: fn(),
      },
      asset: {
        findMany: fn(),
      },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(tx as any)
        }
        return callback
      }),
    } as any

    return {
      service: new FundService(prisma),
      prisma,
      tx,
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

    expect(tx.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tentativeAsset: { increment: decimal(100) },
          cashAsset: { increment: decimal(100) },
          totalAsset: { increment: decimal(100) },
        }),
      }),
    )
    expect(tx.rechargeOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RechargeStatus.COMPLETED,
          settledAt: expect.any(Date),
        }),
      }),
    )
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: AssetChangeType.RECHARGE,
        }),
      }),
    )
    expect(result.data.latestBalance.totalAsset).toBe(250)
  })

  it('rolls back recharge transaction when ledger write fails', async () => {
    const persisted = {
      asset: {
        id: 'asset-1',
        userId: 'user-1',
        tentativeAsset: 100,
        cashAsset: 50,
        totalAsset: 150,
        withdrawFrozenAmount: 0,
      },
      rechargeOrders: [] as Array<{ id: string; status: RechargeStatus }>,
    }

    const prisma = {
      user: {
        findUnique: (jest.fn() as any).mockResolvedValue({
          id: 'user-1',
          username: 'alice',
          asset: {
            id: 'asset-1',
            tentativeAsset: decimal(persisted.asset.tentativeAsset),
            cashAsset: decimal(persisted.asset.cashAsset),
            totalAsset: decimal(persisted.asset.totalAsset),
            withdrawFrozenAmount: decimal(persisted.asset.withdrawFrozenAmount),
          },
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
        const draft = {
          asset: { ...persisted.asset },
          rechargeOrders: [...persisted.rechargeOrders],
        }

        const tx = {
          asset: {
            update: jest.fn(async ({ data }: any) => {
              draft.asset.tentativeAsset += Number(data.tentativeAsset.increment)
              draft.asset.cashAsset += Number(data.cashAsset.increment)
              draft.asset.totalAsset += Number(data.totalAsset.increment)
              return {
                id: draft.asset.id,
                tentativeAsset: decimal(draft.asset.tentativeAsset),
                cashAsset: decimal(draft.asset.cashAsset),
                totalAsset: decimal(draft.asset.totalAsset),
                withdrawFrozenAmount: decimal(draft.asset.withdrawFrozenAmount),
              }
            }),
          },
          rechargeOrder: {
            create: jest.fn(async ({ data }: any) => {
              const order = { id: 're-rollback', status: data.status }
              draft.rechargeOrders.push(order)
              return order
            }),
          },
          ledgerEntry: {
            create: jest.fn(async () => {
              throw new Error('ledger failed')
            }),
          },
          hashRecord: {
            create: jest.fn(),
          },
          auditLog: {
            create: jest.fn(),
          },
        }

        try {
          const result = await callback(tx)
          persisted.asset = draft.asset
          persisted.rechargeOrders = draft.rechargeOrders
          return result
        } catch (error) {
          throw error
        }
      }),
    } as any

    const service = new FundService(prisma)

    await expect(
      service.createRecharge({
        username: 'alice',
        channel: 'wechat',
        amount: 100,
      }),
    ).rejects.toThrow('ledger failed')

    expect(persisted.asset.tentativeAsset).toBe(100)
    expect(persisted.asset.cashAsset).toBe(50)
    expect(persisted.asset.totalAsset).toBe(150)
    expect(persisted.rechargeOrders).toHaveLength(0)
  })

  it('freezes amount on withdrawal submit and keeps queue ordering data', async () => {
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
    tx.withdrawalOrder.findFirst = resolved({ queueNo: 9 })
    tx.asset.update = resolved({
      id: 'asset-1',
      totalAsset: decimal(480),
    })
    tx.withdrawalOrder.create = resolved({
      id: 'wd-1',
      status: WithdrawalStatus.PENDING,
    })

    const result = await service.createWithdrawal({
      username: 'alice',
      amount: 120,
      bankName: '建行',
      bankAccountNo: '62170001',
      bankAccountHolder: '张三',
    })

    expect(tx.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tentativeAsset: { decrement: decimal(120) },
          totalAsset: { decrement: decimal(120) },
          withdrawFrozenAmount: { increment: decimal(120) },
        }),
      }),
    )
    expect(tx.withdrawalOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueNo: 10,
        }),
      }),
    )
    expect(result.data.queueNo).toBe(10)
  })

  it('confirm-completed only releases frozen amount without second deduction', async () => {
    const { service, tx } = createService()
    tx.withdrawalOrder.findUnique = resolved({
      id: 'wd-2',
      userId: 'user-2',
      amount: decimal(88),
      status: WithdrawalStatus.REVIEWING,
      traceId: 'trace-2',
      isVoiceMuted: false,
    })
    tx.asset.findUnique = resolved({
      id: 'asset-2',
      withdrawFrozenAmount: decimal(88),
    })
    tx.asset.update = resolved({
      id: 'asset-2',
      totalAsset: decimal(900),
    })
    tx.withdrawalOrder.update = resolved({
      id: 'wd-2',
      amount: decimal(88),
      status: WithdrawalStatus.COMPLETED,
      traceId: 'trace-2',
      isVoiceMuted: true,
    })

    await service.confirmWithdrawalCompleted('wd-2', { adminUserId: 'admin-1', username: 'admin' })

    const updateArg = (tx.asset.update as any).mock.calls[0][0] as any
    expect(updateArg.data.withdrawFrozenAmount).toEqual({ decrement: decimal(88) })
    expect(updateArg.data.tentativeAsset).toBeUndefined()
    expect(updateArg.data.totalAsset).toBeUndefined()
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: AssetChangeType.WITHDRAW_COMPLETE,
        }),
      }),
    )
  })

  it('applies manual transfer increase and decrease with latest balance returned', async () => {
    const { service, prisma, tx } = createService()
    ;(prisma.user.findUnique as any) = (jest.fn() as any)
      .mockResolvedValueOnce({
        id: 'user-1',
        uid: 'U1',
        username: 'alice',
        asset: {
          id: 'asset-1',
          tentativeAsset: decimal(100),
          cashAsset: decimal(50),
          totalAsset: decimal(150),
          withdrawFrozenAmount: decimal(0),
        },
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        uid: 'U1',
        username: 'alice',
        asset: {
          id: 'asset-1',
          tentativeAsset: decimal(150),
          cashAsset: decimal(50),
          totalAsset: decimal(200),
          withdrawFrozenAmount: decimal(0),
        },
      })

    ;(tx.asset.update as any) = (jest.fn() as any)
      .mockResolvedValueOnce({
        tentativeAsset: decimal(150),
        cashAsset: decimal(50),
        totalAsset: decimal(200),
        withdrawFrozenAmount: decimal(0),
      })
      .mockResolvedValueOnce({
        tentativeAsset: decimal(130),
        cashAsset: decimal(50),
        totalAsset: decimal(180),
        withdrawFrozenAmount: decimal(0),
      })

    const increased = await service.manualTransfer(
      { uid: 'U1', amount: 50, direction: 'increase', reason: '线下补款' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    const decreased = await service.manualAdjust(
      { uid: 'U1', amount: 20, direction: 'decrease', reason: '冲正' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    expect(increased.data.latestBalance.totalAsset).toBe(200)
    expect(decreased.data.latestBalance.totalAsset).toBe(180)
    expect((tx.asset.update as any).mock.calls[0][0].data.totalAsset).toEqual({ increment: decimal(50) })
    expect((tx.asset.update as any).mock.calls[1][0].data.totalAsset).toEqual({ decrement: decimal(20) })
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: AssetChangeType.MANUAL_ADJUST,
        }),
      }),
    )
  })
})
