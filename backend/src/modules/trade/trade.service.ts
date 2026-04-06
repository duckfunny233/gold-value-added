import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  Asset,
  AssetChangeType,
  Prisma,
  PrismaClient,
  TradeOrder,
  TradeSide,
  TradeStatus,
  User,
  UserStatus,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  formatCurrency,
  formatDateTime,
  formatGrams,
  formatInteger,
  resolveAdminTimeRange,
  toNumber,
} from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminTradesQueryDto, TradeDto, TradeQueryDto } from './trade.dto'
import { TradeRuntimeService } from './trade-runtime.service'

type TradeTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>

type TradeUser = User & {
  asset: Asset | null
}

const ACTIVE_ORDER_STATUSES: TradeStatus[] = [TradeStatus.OPEN, TradeStatus.PARTIALLY_FILLED]

@Injectable()
export class TradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tradeRuntimeService: TradeRuntimeService,
  ) {}

  async submit(side: 'BUY' | 'SELL', body: TradeDto) {
    const runtime = await this.tradeRuntimeService.getRuntimeStatus()
    if (runtime.status === 'PAUSED') {
      throw new BadRequestException('当前处于停盘状态，暂不支持提交买卖订单')
    }
    if (!runtime.isOpen) {
      throw new BadRequestException('当前不在交易时段，暂不支持提交买卖订单')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await this.requireTradeUser(tx, body)
      if (user.status === UserStatus.FROZEN) {
        throw new BadRequestException('当前用户已被冻结，无法发起交易')
      }
      if (!user.asset) {
        throw new NotFoundException('用户资产不存在')
      }

      const price = new Prisma.Decimal(body.price)
      const quantityGrams = new Prisma.Decimal(body.quantityGrams)
      const assetCode = body.assetCode || 'AU9999'
      const reservations = await this.getUserReservations(tx, user.id)
      this.assertSufficientAsset(side, user.asset, price, quantityGrams, reservations)

      const traceId = randomUUID()
      const order = await tx.tradeOrder.create({
        data: {
          userId: user.id,
          side,
          status: TradeStatus.OPEN,
          assetCode,
          price,
          quantityGrams,
          traceId,
        },
      })

      await this.createHashRecord(tx, {
        referenceType: 'TRADE_ORDER',
        referenceId: order.id,
        traceId,
        raw: `trade:${order.id}:${traceId}:${side}:${body.price}:${body.quantityGrams}`,
        tradeOrderId: order.id,
      })

      await this.createAuditLog(tx, {
        userId: user.id,
        actorType: 'USER',
        actorId: user.id,
        module: 'trade',
        action: `trade.submit.${side.toLowerCase()}`,
        traceId,
        payload: {
          uid: user.uid,
          username: user.username,
          side,
          price: body.price,
          quantityGrams: body.quantityGrams,
          assetCode,
        } as Prisma.InputJsonValue,
      })

      const matchSummary = await this.executeMatching(tx, {
        incomingOrder: order,
        incomingUser: user,
      })

      const persistedOrder = await tx.tradeOrder.findUnique({
        where: {
          id: order.id,
        },
      })

      if (!persistedOrder) {
        throw new NotFoundException('交易订单不存在')
      }

      return {
        order: persistedOrder,
        matches: matchSummary.matches,
        matchedAmount: matchSummary.matchedAmount,
      }
    })

    return {
      message: side === 'BUY' ? '买单提交成功' : '卖单提交成功',
      data: {
        orderId: result.order.id,
        traceId: result.order.traceId,
        side,
        status: result.order.status,
        assetCode: result.order.assetCode,
        price: body.price,
        quantityGrams: body.quantityGrams,
        filledGrams: Number(result.order.filledGrams),
        matchedAmount: Number(result.matchedAmount),
        matchingRule: 'PRICE_TIME_PRIORITY',
      },
    }
  }

  async getOrders(query: TradeQueryDto = {}) {
    const where = await this.buildTradeQueryWhere(query)
    const orders = await this.prisma.tradeOrder.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    })

    return orders.map((item) => ({
      id: item.id,
      orderId: item.id,
      type: item.side === TradeSide.BUY ? '买入' : '卖出',
      side: item.side,
      name: item.assetCode,
      assetCode: item.assetCode,
      status: item.status,
      time: formatDateTime(item.submittedAt),
      submittedAt: item.submittedAt,
      price: Number(item.price).toFixed(2),
      quantity: Number(item.quantityGrams),
      quantityGrams: Number(item.quantityGrams),
      filledGrams: Number(item.filledGrams),
    }))
  }

  async getAdminOverview() {
    const [runtime, pendingSyncCount] = await Promise.all([
      this.tradeRuntimeService.getRuntimeStatus(),
      this.prisma.hashRecord.count({
        where: {
          tradeOrderId: {
            not: null,
          },
          syncStatus: {
            not: 'SYNCED',
          },
        },
      }),
    ])

    return {
      marketStatus: runtime.status,
      tradingWindow: runtime.currentWindow,
      currentSession: runtime.currentSession,
      nextOpenTime: runtime.nextOpenAt,
      lastSyncAt: runtime.lastSyncedAt,
      pendingSyncCount,
      syncStatus: runtime.syncStatus,
      matchingRule: '高买优先，同价按时间优先',
    }
  }

  async getAdminTrades(query: AdminTradesQueryDto) {
    const orders = await this.prisma.tradeOrder.findMany({
      where: {
        ...(query.tradeNo ? { id: { contains: query.tradeNo } } : {}),
        ...(query.tradeType ? this.buildTradeTypeWhere(query.tradeType) : {}),
        ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
        ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
        ...(query.status ? this.buildTradeStatusWhere(query.status) : {}),
      },
      include: {
        user: true,
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    })

    const [hashRecords, frozenUsers, sessions, runtime] = await Promise.all([
      this.prisma.hashRecord.findMany({
        where: {
          tradeOrderId: {
            in: orders.map((item) => item.id),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.count({
        where: {
          status: UserStatus.FROZEN,
        },
      }),
      this.tradeRuntimeService.getTradingWindows(),
      this.tradeRuntimeService.getRuntimeStatus(),
    ])

    const hashByTradeId = new Map<string, (typeof hashRecords)[number]>()
    for (const item of hashRecords) {
      if (item.tradeOrderId && !hashByTradeId.has(item.tradeOrderId)) {
        hashByTradeId.set(item.tradeOrderId, item)
      }
    }

    const trades = orders
      .map((order, index) => {
        const hash = hashByTradeId.get(order.id)
        return {
          tradeNo: order.id,
          tradeType: order.side === TradeSide.BUY ? '买入' : '卖出',
          uid: order.user.uid,
          nickname: order.user.nickname || order.user.username,
          amount: formatCurrency(this.calculateOrderAmount(order.price, order.quantityGrams)),
          grams: formatGrams(toNumber(order.quantityGrams)),
          status: this.mapTradeStatus(order.status),
          syncStatus: this.mapSyncStatus(hash?.syncStatus),
          createdAt: formatDateTime(order.submittedAt),
          matchPrice: `${formatCurrency(toNumber(order.price))}/克`,
          queuePosition: index + 1,
          _sort: order.submittedAt.getTime(),
        }
      })
      .filter((item) => this.matchesSyncStatus(item.syncStatus, query.syncStatus))

    const pendingSyncCount = trades.filter((item) => item.syncStatus !== '已同步').length
    const filledOrders = orders.filter((item) => item.status === TradeStatus.FILLED)
    const totalGrams = filledOrders.reduce((sum, item) => sum + toNumber(item.quantityGrams), 0)
    const totalAmount = filledOrders.reduce(
      (sum, item) => sum + this.calculateOrderAmount(item.price, item.quantityGrams),
      0,
    )
    const averagePrice = totalGrams === 0 ? 0 : totalAmount / totalGrams

    return {
      stats: [
        {
          label: '当日成交量',
          value: formatGrams(totalGrams || 0),
          note: '买卖数据 1 秒内同步',
        },
        {
          label: '成交金额',
          value: formatCurrency(totalAmount || 0),
          note: '自动撮合成交总额',
        },
        {
          label: '平均成交价',
          value: `${formatCurrency(averagePrice || 0)}/克`,
          note: '行情标的 AU9999',
        },
        {
          label: '同步异常',
          value: `${pendingSyncCount}笔`,
          note: pendingSyncCount ? '可重试同步' : '当前无待同步异常',
        },
      ],
      trades: trades
        .sort((left, right) => right._sort - left._sort)
        .map(({ _sort: _ignored, ...item }) => item),
      controlItems: [
        '撮合规则固定为价格优先、时间优先。',
        '高买先成交，同价按提交时间先后成交。',
        '冻结用户与非交易时间用户都必须被拦截。',
      ],
      monitorCards: [
        {
          key: 'matchPrice',
          label: '撮合价格',
          value:
            averagePrice > 0 ? `当前参考均价 ${formatCurrency(averagePrice)}/克` : '暂无成交价格样本，使用安全空态展示',
        },
        {
          key: 'queuePosition',
          label: '排队位置',
          value: trades.length ? `当前队列共 ${formatInteger(trades.length)} 笔订单` : '当前无交易排队订单',
        },
        {
          key: 'blockedReason',
          label: '拦截原因',
          value:
            runtime.status === 'PAUSED'
              ? '当前全站已停盘，所有买卖订单均会被拦截'
              : frozenUsers > 0
                ? `冻结用户 ${frozenUsers} 人，已纳入交易拦截`
                : '未发现冻结用户触发的交易拦截',
        },
      ],
      sessions: sessions.map((item) => ({
        day: this.mapSessionDays(item.dayIndexes),
        session: item.session,
        status: item.status,
      })),
      syncOverview: {
        source: '上金所交易时段自动同步',
        syncStatus: runtime.syncStatus === 'synced' ? '同步正常' : '安全降级',
        currentSession: runtime.currentWindow,
        nextOpenTime: runtime.status === 'OPEN' ? '当前时段生效中' : runtime.nextOpenAt,
        lastRefreshAt: runtime.lastSyncedAt,
        note:
          runtime.syncStatus === 'synced'
            ? '前端只读展示同步结果，不支持手动修改交易时段。'
            : '未获取到远端交易日历，已按本地交易时段规则降级展示。',
      },
    }
  }

  private async executeMatching(
    tx: TradeTx,
    payload: {
      incomingOrder: TradeOrder
      incomingUser: TradeUser
    },
  ) {
    let incomingFilled = new Prisma.Decimal(payload.incomingOrder.filledGrams)
    let matchedAmount = new Prisma.Decimal(0)
    let matches = 0

    const oppositeOrders = await tx.tradeOrder.findMany({
      where: {
        assetCode: payload.incomingOrder.assetCode,
        side: payload.incomingOrder.side === TradeSide.BUY ? TradeSide.SELL : TradeSide.BUY,
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
        userId: {
          not: payload.incomingOrder.userId,
        },
        ...(payload.incomingOrder.side === TradeSide.BUY
          ? { price: { lte: payload.incomingOrder.price } }
          : { price: { gte: payload.incomingOrder.price } }),
      },
      include: {
        user: {
          include: {
            asset: true,
          },
        },
      },
      orderBy:
        payload.incomingOrder.side === TradeSide.BUY
          ? [{ price: 'asc' }, { submittedAt: 'asc' }]
          : [{ price: 'desc' }, { submittedAt: 'asc' }],
    })

    for (const resting of oppositeOrders) {
      const incomingRemaining = new Prisma.Decimal(payload.incomingOrder.quantityGrams).minus(incomingFilled)
      if (incomingRemaining.lte(0)) {
        break
      }

      const restingRemaining = new Prisma.Decimal(resting.quantityGrams).minus(resting.filledGrams)
      if (restingRemaining.lte(0)) {
        continue
      }

      const matchedGrams = Prisma.Decimal.min(incomingRemaining, restingRemaining)
      const matchedPrice = new Prisma.Decimal(resting.price)
      const matchedValue = matchedPrice.mul(matchedGrams)
      const buyer = payload.incomingOrder.side === TradeSide.BUY ? payload.incomingUser : resting.user
      const seller = payload.incomingOrder.side === TradeSide.SELL ? payload.incomingUser : resting.user

      if (!buyer.asset || !seller.asset) {
        continue
      }
      if (buyer.asset.tentativeAsset.lt(matchedValue) || buyer.asset.cashAsset.lt(matchedValue)) {
        continue
      }
      if (seller.asset.goldHoldingGrams.lt(matchedGrams)) {
        continue
      }

      const updatedBuyerAsset = await tx.asset.update({
        where: {
          userId: buyer.id,
        },
        data: {
          tentativeAsset: {
            decrement: matchedValue,
          },
          cashAsset: {
            decrement: matchedValue,
          },
          goldHoldingGrams: {
            increment: matchedGrams,
          },
        },
      })
      const updatedSellerAsset = await tx.asset.update({
        where: {
          userId: seller.id,
        },
        data: {
          tentativeAsset: {
            increment: matchedValue,
          },
          cashAsset: {
            increment: matchedValue,
          },
          goldHoldingGrams: {
            decrement: matchedGrams,
          },
        },
      })

      const updatedRestingFilled = new Prisma.Decimal(resting.filledGrams).plus(matchedGrams)
      await tx.tradeOrder.update({
        where: {
          id: resting.id,
        },
        data: {
          filledGrams: updatedRestingFilled,
          status: this.resolveOrderStatus(updatedRestingFilled, new Prisma.Decimal(resting.quantityGrams)),
          completedAt: updatedRestingFilled.gte(resting.quantityGrams) ? new Date() : null,
        },
      })

      incomingFilled = incomingFilled.plus(matchedGrams)
      await tx.tradeOrder.update({
        where: {
          id: payload.incomingOrder.id,
        },
        data: {
          filledGrams: incomingFilled,
          status: this.resolveOrderStatus(incomingFilled, new Prisma.Decimal(payload.incomingOrder.quantityGrams)),
          completedAt: incomingFilled.gte(payload.incomingOrder.quantityGrams) ? new Date() : null,
        },
      })

      const matchTraceId = randomUUID()
      await tx.tradeMatch.create({
        data: {
          buyOrderId: payload.incomingOrder.side === TradeSide.BUY ? payload.incomingOrder.id : resting.id,
          sellOrderId: payload.incomingOrder.side === TradeSide.SELL ? payload.incomingOrder.id : resting.id,
          matchedPrice,
          matchedGrams,
          traceId: matchTraceId,
        },
      })

      await this.createLedgerEntry(tx, {
        assetId: updatedBuyerAsset.id,
        userId: buyer.id,
        changeType: AssetChangeType.TRADE_BUY,
        amount: matchedValue,
        traceId: matchTraceId,
        balanceAfter: updatedBuyerAsset.totalAsset,
        referenceType: 'TRADE_MATCH',
        referenceId: payload.incomingOrder.id,
      })
      await this.createLedgerEntry(tx, {
        assetId: updatedSellerAsset.id,
        userId: seller.id,
        changeType: AssetChangeType.TRADE_SELL,
        amount: matchedValue,
        traceId: matchTraceId,
        balanceAfter: updatedSellerAsset.totalAsset,
        referenceType: 'TRADE_MATCH',
        referenceId: resting.id,
      })
      await this.createAuditLog(tx, {
        userId: buyer.id,
        actorType: 'SYSTEM',
        actorId: null,
        module: 'trade',
        action: 'trade.match.buy',
        traceId: matchTraceId,
        payload: {
          buyOrderId: payload.incomingOrder.side === TradeSide.BUY ? payload.incomingOrder.id : resting.id,
          sellOrderId: payload.incomingOrder.side === TradeSide.SELL ? payload.incomingOrder.id : resting.id,
          matchedPrice: Number(matchedPrice),
          matchedGrams: Number(matchedGrams),
        } as Prisma.InputJsonValue,
      })
      await this.createAuditLog(tx, {
        userId: seller.id,
        actorType: 'SYSTEM',
        actorId: null,
        module: 'trade',
        action: 'trade.match.sell',
        traceId: matchTraceId,
        payload: {
          buyOrderId: payload.incomingOrder.side === TradeSide.BUY ? payload.incomingOrder.id : resting.id,
          sellOrderId: payload.incomingOrder.side === TradeSide.SELL ? payload.incomingOrder.id : resting.id,
          matchedPrice: Number(matchedPrice),
          matchedGrams: Number(matchedGrams),
        } as Prisma.InputJsonValue,
      })
      await this.createHashRecord(tx, {
        referenceType: 'TRADE_MATCH',
        referenceId: `${payload.incomingOrder.id}:${resting.id}:${matchTraceId}`,
        traceId: matchTraceId,
        raw: `trade_match:${payload.incomingOrder.id}:${resting.id}:${matchedPrice.toString()}:${matchedGrams.toString()}`,
      })

      matchedAmount = matchedAmount.plus(matchedValue)
      matches += 1
    }

    return {
      matches,
      matchedAmount,
    }
  }

  private assertSufficientAsset(
    side: TradeSide,
    asset: Asset,
    price: Prisma.Decimal,
    quantityGrams: Prisma.Decimal,
    reservations: {
      buyCashReserved: Prisma.Decimal
      sellGoldReserved: Prisma.Decimal
    },
  ) {
    if (side === TradeSide.BUY) {
      const required = price.mul(quantityGrams)
      const availableTentative = new Prisma.Decimal(asset.tentativeAsset).minus(reservations.buyCashReserved)
      const availableCash = new Prisma.Decimal(asset.cashAsset).minus(reservations.buyCashReserved)
      if (availableTentative.lt(required) || availableCash.lt(required)) {
        throw new BadRequestException('可用资产不足，无法发起买入')
      }
      return
    }

    const availableGold = new Prisma.Decimal(asset.goldHoldingGrams).minus(reservations.sellGoldReserved)
    if (availableGold.lt(quantityGrams)) {
      throw new BadRequestException('持有黄金克数不足，无法发起卖出')
    }
  }

  private async getUserReservations(tx: TradeTx, userId: string) {
    const openOrders = await tx.tradeOrder.findMany({
      where: {
        userId,
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
      },
    })

    return openOrders.reduce(
      (acc, order) => {
        const remaining = new Prisma.Decimal(order.quantityGrams).minus(order.filledGrams)
        if (remaining.lte(0)) {
          return acc
        }
        if (order.side === TradeSide.BUY) {
          acc.buyCashReserved = acc.buyCashReserved.plus(new Prisma.Decimal(order.price).mul(remaining))
        } else {
          acc.sellGoldReserved = acc.sellGoldReserved.plus(remaining)
        }
        return acc
      },
      {
        buyCashReserved: new Prisma.Decimal(0),
        sellGoldReserved: new Prisma.Decimal(0),
      },
    )
  }

  private buildTradeTypeWhere(value: string) {
    const normalized = value.toLowerCase()
    if (normalized === 'buy' || normalized === '买入') {
      return { side: TradeSide.BUY }
    }
    if (normalized === 'sell' || normalized === '卖出') {
      return { side: TradeSide.SELL }
    }
    return {}
  }

  private buildTradeStatusWhere(value: string) {
    const normalized = value.toLowerCase()
    if (normalized === 'success' || normalized === '成功') {
      return { status: TradeStatus.FILLED }
    }
    if (normalized === 'processing' || normalized === '处理中') {
      return { status: { in: [TradeStatus.OPEN, TradeStatus.PARTIALLY_FILLED] } }
    }
    if (normalized === 'failed' || normalized === '失败') {
      return { status: { in: [TradeStatus.CANCELLED, TradeStatus.REJECTED] } }
    }
    return {}
  }

  private calculateOrderAmount(price: Prisma.Decimal | number, grams: Prisma.Decimal | number) {
    return toNumber(price) * toNumber(grams)
  }

  private resolveOrderStatus(filledGrams: Prisma.Decimal, quantityGrams: Prisma.Decimal) {
    if (filledGrams.gte(quantityGrams)) {
      return TradeStatus.FILLED
    }
    if (filledGrams.gt(0)) {
      return TradeStatus.PARTIALLY_FILLED
    }
    return TradeStatus.OPEN
  }

  private mapTradeStatus(status: TradeStatus) {
    if (status === TradeStatus.FILLED) {
      return '成功'
    }
    if (status === TradeStatus.CANCELLED || status === TradeStatus.REJECTED) {
      return '失败'
    }
    return '处理中'
  }

  private mapSyncStatus(syncStatus?: string) {
    if (syncStatus === 'SYNCED') {
      return '已同步'
    }
    if (!syncStatus || syncStatus === 'PENDING') {
      return '待同步'
    }
    return '同步异常'
  }

  private matchesSyncStatus(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (normalized === 'synced' || normalized === '已同步') {
      return value === '已同步'
    }
    if (normalized === 'pending' || normalized === '待同步') {
      return value === '待同步'
    }
    if (normalized === 'failed' || normalized === '异常' || normalized === '同步异常') {
      return value === '同步异常'
    }
    return value.includes(queryValue)
  }

  private mapSessionDays(dayIndexes: number[]) {
    const values = dayIndexes.join(',')
    if (values === '1,2,3,4,5') {
      return '周一至周五'
    }
    if (values === '2,3,4,5,6') {
      return '周二至周六凌晨'
    }
    return '自动同步'
  }

  private async buildTradeQueryWhere(query: TradeQueryDto) {
    if (!query.uid && !query.username) {
      return undefined
    }

    const user = await this.resolveTradeUser(query)
    return {
      userId: user.id,
    }
  }

  private async resolveTradeUser(query: Pick<TradeDto, 'username' | 'uid'>) {
    const where = query.uid
      ? { uid: query.uid }
      : query.username
        ? { username: query.username }
        : undefined

    if (!where) {
      throw new BadRequestException('交易请求缺少用户标识')
    }

    const user = await this.prisma.user.findFirst({
      where,
      include: {
        asset: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  private async requireTradeUser(tx: TradeTx, query: Pick<TradeDto, 'username' | 'uid'>): Promise<TradeUser> {
    const where = query.uid
      ? { uid: query.uid }
      : query.username
        ? { username: query.username }
        : undefined

    if (!where) {
      throw new BadRequestException('交易请求缺少用户标识')
    }

    const user = await tx.user.findFirst({
      where,
      include: {
        asset: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  private async createHashRecord(
    tx: TradeTx,
    payload: {
      referenceType: string
      referenceId: string
      traceId: string
      raw: string
      tradeOrderId?: string
    },
  ) {
    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(payload.raw),
        syncStatus: 'PENDING',
        tradeOrderId: payload.tradeOrderId,
      },
    })
  }

  private async createAuditLog(
    tx: TradeTx,
    payload: {
      userId: string | null
      actorType: string
      actorId: string | null
      module: string
      action: string
      traceId: string
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.auditLog.create({
      data: {
        userId: payload.userId,
        actorType: payload.actorType,
        actorId: payload.actorId,
        module: payload.module,
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })
  }

  private async createLedgerEntry(
    tx: TradeTx,
    payload: {
      assetId: string
      userId: string
      changeType: AssetChangeType
      amount: Prisma.Decimal
      traceId: string
      balanceAfter: Prisma.Decimal
      referenceType: string
      referenceId: string
    },
  ) {
    await tx.ledgerEntry.create({
      data: {
        assetId: payload.assetId,
        userId: payload.userId,
        changeType: payload.changeType,
        amount: payload.amount,
        traceId: payload.traceId,
        balanceAfter: payload.balanceAfter,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
      },
    })
  }
}
