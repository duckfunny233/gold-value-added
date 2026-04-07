import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, jest } from '@jest/globals'
import { Prisma, TradeSide, TradeStatus, UserStatus } from '@prisma/client'
import { TradeService } from './trade.service'
import { TradeRuntimeService } from './trade-runtime.service'

describe('TradeService V1', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)
  const fn = () => jest.fn() as any

  const createService = () => {
    const tx = {
      user: {
        findFirst: fn(),
      },
      tradeOrder: {
        create: fn(),
        findUnique: fn(),
        findMany: fn(),
        update: fn(),
      },
      asset: {
        update: fn(),
      },
      tradeMatch: {
        create: fn(),
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
      tradeOrder: {
        findMany: fn(),
      },
      hashRecord: {
        findMany: fn(),
        count: fn(),
        create: fn(),
      },
      auditLog: {
        create: fn(),
      },
      user: {
        count: fn(),
        findFirst: fn(),
      },
      $transaction: jest.fn(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(tx as any)
        }
        return callback
      }),
    } as any

    const runtimeService = {
      getRuntimeStatus: jest.fn(),
      getTradingWindows: jest.fn(),
    } as unknown as TradeRuntimeService

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
      service: new TradeService(prisma, runtimeService, operationIdempotencyService),
      prisma,
      tx,
      runtimeService,
      operationIdempotencyService,
    }
  }

  it('matches by better price first and then by earlier submittedAt', async () => {
    const { service, tx, runtimeService } = createService()
    ;(runtimeService.getRuntimeStatus as any).mockResolvedValue({
      status: 'OPEN',
      isOpen: true,
    })
    tx.user.findFirst = resolved({
      id: 'buyer-1',
      uid: 'U1',
      username: 'buyer',
      status: UserStatus.ACTIVE,
      asset: {
        id: 'asset-buyer',
        tentativeAsset: decimal(2000),
        cashAsset: decimal(2000),
        goldHoldingGrams: decimal(0),
      },
    })
    tx.tradeOrder.create = resolved({
      id: 'incoming-buy',
      userId: 'buyer-1',
      side: TradeSide.BUY,
      status: TradeStatus.OPEN,
      assetCode: 'AU9999',
      price: decimal(565),
      quantityGrams: decimal(3),
      filledGrams: decimal(0),
      traceId: 'trace-incoming',
    })
    ;(tx.tradeOrder.findMany as any) = (jest.fn() as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'sell-best-price',
          userId: 'seller-2',
          side: TradeSide.SELL,
          status: TradeStatus.OPEN,
          assetCode: 'AU9999',
          price: decimal(560),
          quantityGrams: decimal(1),
          filledGrams: decimal(0),
          submittedAt: new Date('2026-04-07T09:00:00.000Z'),
          user: {
            id: 'seller-2',
            asset: { id: 'asset-s2', tentativeAsset: decimal(0), cashAsset: decimal(0), goldHoldingGrams: decimal(5) },
          },
        },
        {
          id: 'sell-earlier-time',
          userId: 'seller-3',
          side: TradeSide.SELL,
          status: TradeStatus.OPEN,
          assetCode: 'AU9999',
          price: decimal(561),
          quantityGrams: decimal(1),
          filledGrams: decimal(0),
          submittedAt: new Date('2026-04-07T09:01:00.000Z'),
          user: {
            id: 'seller-3',
            asset: { id: 'asset-s3', tentativeAsset: decimal(0), cashAsset: decimal(0), goldHoldingGrams: decimal(5) },
          },
        },
        {
          id: 'sell-later-time',
          userId: 'seller-4',
          side: TradeSide.SELL,
          status: TradeStatus.OPEN,
          assetCode: 'AU9999',
          price: decimal(561),
          quantityGrams: decimal(1),
          filledGrams: decimal(0),
          submittedAt: new Date('2026-04-07T09:05:00.000Z'),
          user: {
            id: 'seller-4',
            asset: { id: 'asset-s4', tentativeAsset: decimal(0), cashAsset: decimal(0), goldHoldingGrams: decimal(5) },
          },
        },
      ])
    tx.asset.update = resolved({
      id: 'asset-any',
      totalAsset: decimal(1000),
    })
    tx.tradeOrder.update = resolved({})
    tx.tradeOrder.findUnique = resolved({
      id: 'incoming-buy',
      traceId: 'trace-incoming',
      assetCode: 'AU9999',
      status: TradeStatus.FILLED,
      filledGrams: decimal(3),
    })

    await service.submit('BUY', {
      username: 'buyer',
      price: 565,
      quantityGrams: 3,
    })

    expect((tx.tradeMatch.create as any).mock.calls.map((call: any) => call[0].data.sellOrderId)).toEqual([
      'sell-best-price',
      'sell-earlier-time',
      'sell-later-time',
    ])
  })

  it('blocks trade when not in trading session', async () => {
    const { service, runtimeService } = createService()
    ;(runtimeService.getRuntimeStatus as any).mockResolvedValue({
      status: 'CLOSED',
      isOpen: false,
    })

    await expect(
      service.submit('BUY', {
        username: 'buyer',
        price: 565,
        quantityGrams: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('blocks trade for frozen user', async () => {
    const { service, tx, runtimeService } = createService()
    ;(runtimeService.getRuntimeStatus as any).mockResolvedValue({
      status: 'OPEN',
      isOpen: true,
    })
    tx.user.findFirst = resolved({
      id: 'buyer-1',
      uid: 'U1',
      username: 'buyer',
      status: UserStatus.FROZEN,
      asset: {
        id: 'asset-buyer',
        tentativeAsset: decimal(1000),
        cashAsset: decimal(1000),
        goldHoldingGrams: decimal(0),
      },
    })

    await expect(
      service.submit('BUY', {
        username: 'buyer',
        price: 565,
        quantityGrams: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('blocks trade when platform is paused', async () => {
    const { service, runtimeService } = createService()
    ;(runtimeService.getRuntimeStatus as any).mockResolvedValue({
      status: 'PAUSED',
      isOpen: false,
    })

    await expect(
      service.submit('SELL', {
        username: 'seller',
        price: 560,
        quantityGrams: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('updates buyer and seller assets without extra deduction', async () => {
    const { service, tx, runtimeService } = createService()
    ;(runtimeService.getRuntimeStatus as any).mockResolvedValue({
      status: 'OPEN',
      isOpen: true,
    })
    tx.user.findFirst = resolved({
      id: 'buyer-1',
      uid: 'U1',
      username: 'buyer',
      status: UserStatus.ACTIVE,
      asset: {
        id: 'asset-buyer',
        tentativeAsset: decimal(2000),
        cashAsset: decimal(2000),
        goldHoldingGrams: decimal(0),
      },
    })
    tx.tradeOrder.create = resolved({
      id: 'incoming-buy',
      userId: 'buyer-1',
      side: TradeSide.BUY,
      status: TradeStatus.OPEN,
      assetCode: 'AU9999',
      price: decimal(560),
      quantityGrams: decimal(2),
      filledGrams: decimal(0),
      traceId: 'trace-incoming',
    })
    ;(tx.tradeOrder.findMany as any) = (jest.fn() as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'sell-1',
          userId: 'seller-1',
          side: TradeSide.SELL,
          status: TradeStatus.OPEN,
          assetCode: 'AU9999',
          price: decimal(560),
          quantityGrams: decimal(2),
          filledGrams: decimal(0),
          submittedAt: new Date('2026-04-07T09:00:00.000Z'),
          user: {
            id: 'seller-1',
            asset: {
              id: 'asset-seller',
              tentativeAsset: decimal(100),
              cashAsset: decimal(100),
              goldHoldingGrams: decimal(5),
            },
          },
        },
      ])
    ;(tx.asset.update as any) = (jest.fn() as any)
      .mockResolvedValueOnce({ id: 'asset-buyer', totalAsset: decimal(1000) })
      .mockResolvedValueOnce({ id: 'asset-seller', totalAsset: decimal(100) })
    tx.tradeOrder.update = resolved({})
    tx.tradeOrder.findUnique = resolved({
      id: 'incoming-buy',
      traceId: 'trace-incoming',
      assetCode: 'AU9999',
      status: TradeStatus.FILLED,
      filledGrams: decimal(2),
    })

    await service.submit('BUY', {
      username: 'buyer',
      price: 560,
      quantityGrams: 2,
    })

    expect((tx.asset.update as any).mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        tentativeAsset: { decrement: decimal(1120) },
        cashAsset: { decrement: decimal(1120) },
        goldHoldingGrams: { increment: decimal(2) },
      }),
    )
    expect((tx.asset.update as any).mock.calls[1][0].data).toEqual(
      expect.objectContaining({
        tentativeAsset: { increment: decimal(1120) },
        cashAsset: { increment: decimal(1120) },
        goldHoldingGrams: { decrement: decimal(2) },
      }),
    )
  })

  it('does not create duplicate buy order for same idempotency key', async () => {
    const { service, tx, prisma, runtimeService, operationIdempotencyService } = createService()
    ;(runtimeService.getRuntimeStatus as any).mockResolvedValue({
      status: 'OPEN',
      isOpen: true,
    })
    tx.user.findFirst = resolved({
      id: 'buyer-1',
      uid: 'U1',
      username: 'buyer',
      status: UserStatus.ACTIVE,
      asset: {
        id: 'asset-buyer',
        tentativeAsset: decimal(2000),
        cashAsset: decimal(2000),
        goldHoldingGrams: decimal(0),
      },
    })
    prisma.user.findFirst = resolved({
      id: 'buyer-1',
      uid: 'U1',
      username: 'buyer',
      status: UserStatus.ACTIVE,
      asset: {
        id: 'asset-buyer',
        tentativeAsset: decimal(2000),
        cashAsset: decimal(2000),
        goldHoldingGrams: decimal(0),
      },
    })
    tx.tradeOrder.create = resolved({
      id: 'incoming-buy',
      userId: 'buyer-1',
      side: TradeSide.BUY,
      status: TradeStatus.OPEN,
      assetCode: 'AU9999',
      price: decimal(565),
      quantityGrams: decimal(1),
      filledGrams: decimal(0),
      traceId: 'trace-buy',
    })
    ;(tx.tradeOrder.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    tx.tradeOrder.findUnique = resolved({
      id: 'incoming-buy',
      traceId: 'trace-buy',
      assetCode: 'AU9999',
      status: TradeStatus.OPEN,
      filledGrams: decimal(0),
    })
    ;(operationIdempotencyService.reserve as any)
      .mockResolvedValueOnce({
        mode: 'execute',
        id: 'idem-buy',
        key: 'buy-key',
        requestHash: 'hash',
        traceId: 'trace-buy',
      })
      .mockResolvedValueOnce({
        mode: 'replay',
        id: 'idem-buy',
        key: 'buy-key',
        requestHash: 'hash',
        traceId: 'trace-buy',
        responsePayload: {
          message: '买单提交成功',
          data: {
            orderId: 'incoming-buy',
            traceId: 'trace-buy',
            side: 'BUY',
            status: TradeStatus.OPEN,
            assetCode: 'AU9999',
            price: 565,
            quantityGrams: 1,
            filledGrams: 0,
            matchedAmount: 0,
            matchingRule: 'PRICE_TIME_PRIORITY',
          },
        },
      })

    const first = (await service.submit(
      'BUY',
      {
        username: 'buyer',
        price: 565,
        quantityGrams: 1,
        clientRequestId: 'buy-key',
      },
      'buy-key',
    )) as any
    const second = (await service.submit(
      'BUY',
      {
        username: 'buyer',
        price: 565,
        quantityGrams: 1,
        clientRequestId: 'buy-key',
      },
      'buy-key',
    )) as any

    expect(first.data.orderId).toBe('incoming-buy')
    expect(second.data.orderId).toBe('incoming-buy')
    expect(tx.tradeOrder.create).toHaveBeenCalledTimes(1)
  })
})
