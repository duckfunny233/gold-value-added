import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import {
  Prisma,
  RealNameStatus,
  RechargeStatus,
  TradeSide,
  TradeStatus,
  TradeOrder,
  UserStatus,
  WithdrawalOrder,
  WithdrawalStatus,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  formatCurrency,
  formatDateTime,
  formatGrams,
  getJsonRecord,
  resolveAdminTimeRange,
  toNumber,
  unique,
} from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { MarketService } from '../market/market.service'
import {
  AdminUserManualCheckDto,
  AdminUsersQueryDto,
  PaymentMethodDto,
  UserQueryDto,
} from './user.dto'

type AdminActor = {
  adminUserId: string
  username: string
}

type AppPaymentMethod = {
  type: 'wechat' | 'alipay' | 'bankcard'
  name: string
  account?: string
  bankName?: string
  qrCode?: string
  id: string
  createdAt: string
  updatedAt: string
}

type MarketUnitPrices = {
  goldPricePerGram: number
  silverPricePerGram: number
}

type LiveAssetMetrics = {
  tentativeAsset: number
  cashAsset: number
  goldGrams: number
  silverGrams: number
  marketValue: number
  availableBalance: number
  totalAsset: number
  appreciationIncome: number
  withdrawFrozenAmount: number
}

const METAL_SPECS = [1, 10, 50, 100, 1000, 5000] as const
const GOLD_UNIT_PRICE = 1046.2
const SILVER_UNIT_PRICE = 18.83
const STANDARD_FEE_RATE = 0.001
const P2P_FEE_FREE_THRESHOLD = 100

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly marketService?: MarketService,
  ) {}

  async getPublicLeaderboard(limitInput?: string | number) {
    const limit = this.resolveLeaderboardLimit(limitInput)
    const assets = await this.prisma.asset.findMany({
      include: {
        user: {
          select: {
            uid: true,
            nickname: true,
            username: true,
            createdAt: true,
          },
        },
      },
    })

    const registerSequenceByUid = new Map(
      assets
        .map((item) => item.user)
        .sort((left, right) => {
          const leftTime = left.createdAt?.getTime?.() || 0
          const rightTime = right.createdAt?.getTime?.() || 0
          if (leftTime !== rightTime) {
            return leftTime - rightTime
          }
          return String(left.uid).localeCompare(String(right.uid))
        })
        .map((user, index) => [user.uid, index + 1]),
    )

    const leaderboardItems = assets
      .map((item) => ({
        uid: item.user.uid,
        nickname: item.user.nickname || item.user.username,
        goldGrams: toNumber(item.goldHoldingGrams),
        totalAsset: toNumber(item.totalAsset),
        sequenceNo:
          registerSequenceByUid.get(item.user.uid) || this.extractUidSequenceNo(String(item.user.uid)),
        updatedAt: item.updatedAt,
      }))
      .sort((left, right) => {
        if (right.goldGrams !== left.goldGrams) {
          return right.goldGrams - left.goldGrams
        }
        if (right.totalAsset !== left.totalAsset) {
          return right.totalAsset - left.totalAsset
        }
        if (left.sequenceNo !== right.sequenceNo) {
          return left.sequenceNo - right.sequenceNo
        }
        return String(left.uid).localeCompare(String(right.uid))
      })
      .slice(0, limit)

    return {
      items: leaderboardItems.map((item, index) => ({
        rank: index + 1,
        sequenceNo: item.sequenceNo,
        uid: item.uid,
        nickname: item.nickname,
        goldGrams: item.goldGrams,
        totalAsset: item.totalAsset,
        // 兼容旧前端字段，后续可删除
        investedAmount: item.totalAsset,
        updatedAt: formatDateTime(item.updatedAt),
      })),
    }
  }

  async getPublicGoldChain() {
    const buyOrders: any[] = await this.prisma.tradeOrder.findMany({
      where: {
        side: TradeSide.BUY,
        status: {
          not: TradeStatus.CANCELLED,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            nickname: true,
            username: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: 50,
    })

    if (!buyOrders.length) {
      return {
        items: [],
      }
    }

    return {
      items: buyOrders.map((order, index) => {
        const user = order.user
        return {
          sequenceNo: 100001 + index,
          nickname: user?.nickname || user?.username || '匿名用户',
          assetCode: order.assetCode || '',
          quantityGrams: Number(toNumber(order.quantityGrams).toFixed(4)),
          submittedAt: formatDateTime(order.submittedAt),
          orderId: order.id,
        }
      }),
    }
  }

  async getAssetOverview(query: UserQueryDto) {
    const user = await this.findUser(query)
    if (!user?.asset) {
      throw new NotFoundException('用户资产不存在')
    }

    const metrics = await this.computeLiveAssetMetrics(user.id, user.asset)

    return {
      uid: user.uid,
      username: user.username,
      tentativeAsset: metrics.tentativeAsset,
      cashAsset: metrics.cashAsset,
      appreciationIncome: metrics.appreciationIncome,
      goldHoldingGrams: metrics.goldGrams,
      withdrawFrozenAmount: metrics.withdrawFrozenAmount,
      marketValue: metrics.marketValue,
      totalAsset: metrics.totalAsset,
      updatedAt: user.asset.updatedAt,
    }
  }

  async getAppProfile(query: UserQueryDto = {}) {
    const user = await this.resolveAppUser(query)
    const metrics = await this.computeLiveAssetMetrics(user.id, user.asset)
    const {
      goldGrams,
      silverGrams,
      tentativeAsset,
      appreciationIncome,
      withdrawFrozenAmount,
      marketValue,
      availableBalance,
      totalAsset,
    } = metrics
    const { goldPricePerGram, silverPricePerGram } = await this.resolveMarketUnitPrices()

    const userAvatar =
      user.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.uid)}`

    const principalBalance = Math.max(totalAsset - appreciationIncome, 0)
    const withdrawablePrincipal = Math.max(principalBalance - withdrawFrozenAmount, 0)

    // 昨日收益：按撮合成交(tradeMatch)使用 FIFO 成本法计算"昨日已实现盈亏"（暂不计手续费）
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(todayStart.getDate() - 1)
    const yesterdayProfit = await this.calculateYesterdayRealizedProfitFifo(
      user.id,
      yesterdayStart,
      todayStart,
    )

    return {
      id: user.uid,
      uid: user.uid,
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: userAvatar,
      fee: '--',
      realNameVerified: user.realNameStatus === RealNameStatus.VERIFIED,
      principalBalance,
      withdrawablePrincipal,
      appreciationIncome,
      tentativeAsset,
      assets: [
        { key: 'profile.assets.total', value: this.formatMoney(totalAsset), unit: 'CNY' },
        {
          key: 'profile.assets.balance',
          value: this.formatMoney(availableBalance),
          unit: 'CNY',
        },
        {
          key: 'profile.assets.marketValue',
          value: this.formatMoney(marketValue),
          unit: 'CNY',
        },
        {
          key: 'profile.assets.yesterdayProfit',
          value: this.formatSignedMoney(yesterdayProfit),
          unit: 'CNY',
          trend: yesterdayProfit >= 0 ? 'up' : 'down',
        },
        {
          key: 'profile.assets.accumulatedProfit',
          value: this.formatSignedMoney(appreciationIncome),
          unit: 'CNY',
          trend: appreciationIncome >= 0 ? 'up' : 'down',
        },
        // Profile 页面“暂定资产”展示为 tentativeAsset（不随行情波动）
        {
          key: 'profile.tempAssets',
          value: this.formatMoney(availableBalance),
          unit: 'CNY',
        },
      ],
      goldPositions: this.buildMetalPositions('gold', goldGrams, goldPricePerGram),
      silverPositions: this.buildMetalPositions(
        'silver',
        silverGrams,
        silverPricePerGram,
      ),
    }
  }

  async hasRechargeHistory(query: UserQueryDto = {}) {
    const user = await this.resolveAppUser(query)
    const count = await this.prisma.rechargeOrder.count({
      where: {
        userId: user.id,
        status: {
          in: [
            RechargeStatus.PENDING,
            RechargeStatus.PROCESSING,
            RechargeStatus.COMPLETED,
          ],
        },
      },
    })
    return count > 0
  }

  async getPaymentMethod(query: UserQueryDto = {}) {
    const user = await this.resolveAppUser(query)
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: this.paymentMethodConfigKey(user.id),
      },
    })
    return this.parsePaymentMethodConfig(config?.configValue)
  }

  async bindPaymentMethod(body: PaymentMethodDto) {
    const user = await this.resolveAppUser({
      uid: body.uid,
      username: body.username,
    })

    const normalizedType = this.normalizePaymentType(body.type)
    const name = String(body.name || '').trim()
    if (!normalizedType || !name) {
      throw new NotFoundException('收款方式参数不完整')
    }

    const payload: AppPaymentMethod = {
      id: `pm_${Date.now()}`,
      type: normalizedType,
      name,
      account: body.account?.trim() || '',
      bankName: body.bankName?.trim() || '',
      qrCode: body.qrCode || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await this.prisma.systemConfig.upsert({
      where: {
        configKey: this.paymentMethodConfigKey(user.id),
      },
      create: {
        configKey: this.paymentMethodConfigKey(user.id),
        configValue: payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        configValue: payload as unknown as Prisma.InputJsonValue,
      },
    })

    return payload
  }

  async unbindPaymentMethod(query: UserQueryDto = {}) {
    const user = await this.resolveAppUser(query)
    await this.prisma.systemConfig.deleteMany({
      where: {
        configKey: this.paymentMethodConfigKey(user.id),
      },
    })
    return { success: true }
  }

  async getProfile(query: UserQueryDto) {
    const user = await this.findUser(query)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return {
      uid: user.uid,
      username: user.username,
      phone: user.phone,
      email: user.email,
      realNameStatus: user.realNameStatus,
      status: user.status,
      createdAt: user.createdAt,
    }
  }

  async getAdminUsers(query: AdminUsersQueryDto) {
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10))
    const emptyPayload = {
      rows: [] as Array<Record<string, unknown>>,
      total: 0,
      selectedUser: {},
      relatedRecords: { recharge: [], withdraw: [], trade: [], audit: [] },
    }

    const exactUid = query.uid?.trim()
    if (exactUid) {
      const exactUser = await this.prisma.user.findUnique({
        where: { uid: exactUid },
        include: { asset: true },
      })
      if (exactUser) {
        return this.composeAdminUsersPayload({
          query,
          page,
          pageSize,
          users: [exactUser],
          total: 1,
          selectedUserId: exactUser.id,
        })
      }
    }

    const where: Prisma.UserWhereInput = {
      ...(query.userId?.trim() ? { id: { contains: query.userId.trim() } } : {}),
      ...(exactUid ? { uid: { contains: exactUid, mode: 'insensitive' as const } } : {}),
      ...(query.realNameStatus ? this.buildRealNameWhere(query.realNameStatus) : {}),
      ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
    }

    const needsPostFilter = Boolean(
      query.sequenceNo?.trim() || query.rechargeStatus?.trim() || query.withdrawStatus?.trim(),
    )

    if (needsPostFilter) {
      const users = await this.prisma.user.findMany({
        where,
        include: { asset: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      if (!users.length) {
        return emptyPayload
      }
      return this.composeAdminUsersPayload({
        query,
        page,
        pageSize,
        users,
        postFilter: true,
      })
    }

    const total = await this.prisma.user.count({ where })
    if (!total) {
      return emptyPayload
    }

    const users = await this.prisma.user.findMany({
      where,
      include: { asset: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return this.composeAdminUsersPayload({
      query,
      page,
      pageSize,
      users,
      total,
    })
  }

  async manualCheckUser(uid: string, body: AdminUserManualCheckDto, actor: AdminActor) {
    const user = await this.prisma.user.findUnique({
      where: {
        uid,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const traceId = randomUUID()
    await this.prisma.$transaction(async (tx) => {
      const payload = {
        uid,
        note: body.note?.trim() || '已通过后台人工核查入口发起复核',
        result: '成功',
      } as Prisma.InputJsonValue

      await tx.adminOperationLog.create({
        data: {
          adminUserId: actor.adminUserId,
          module: 'user',
          action: 'user.manual-check',
          traceId,
          payload,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'user',
          action: 'user.manual-check',
          traceId,
          payload,
        },
      })

      await tx.hashRecord.create({
        data: {
          referenceType: 'USER_MANUAL_CHECK',
          referenceId: user.id,
          traceId,
          sha256: sha256(`USER_MANUAL_CHECK:${user.id}:${traceId}:${JSON.stringify(payload)}`),
          syncStatus: 'PENDING',
        },
      })
    })

    return {
      message: '人工核查已登记',
      data: {
        uid,
        traceId,
        note: body.note?.trim() || '已通过后台人工核查入口发起复核',
      },
    }
  }

  private async resolveAppUser(query: UserQueryDto = {}) {
    const user = await this.findUser(query)
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
  }

  private paymentMethodConfigKey(userId: string) {
    return `user_payment_method:${userId}`
  }

  private parsePaymentMethodConfig(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const record = value as Record<string, unknown>
    const type = this.normalizePaymentType(record.type)
    const name = String(record.name || '').trim()
    if (!type || !name) {
      return null
    }
    return {
      id: String(record.id || ''),
      type,
      name,
      account: String(record.account || ''),
      bankName: String(record.bankName || ''),
      qrCode: String(record.qrCode || ''),
      createdAt: String(record.createdAt || ''),
      updatedAt: String(record.updatedAt || ''),
    }
  }

  private normalizePaymentType(input: unknown) {
    const raw = String(input || '').toLowerCase()
    if (raw === 'wechat') {
      return 'wechat' as const
    }
    if (raw === 'alipay') {
      return 'alipay' as const
    }
    if (raw === 'bankcard' || raw === 'bank') {
      return 'bankcard' as const
    }
    return null
  }

  private buildMetalPositions(
    type: 'gold' | 'silver',
    totalGrams: number,
    unitPrice: number,
  ) {
    let remaining = Math.max(0, Number(totalGrams.toFixed(4)))
    return METAL_SPECS.slice().sort((a, b) => a - b).map((grams) => {
      const count = Math.floor(remaining / grams)
      remaining = Number((remaining - count * grams).toFixed(4))
      return {
        level: this.getMetalLevel(type, grams),
        weight: `${grams}g`,
        price: this.formatMoney(grams * unitPrice),
        count,
        bgImage: this.getMetalImage(type, grams),
      }
    })
  }

  private getMetalLevel(type: 'gold' | 'silver', grams: number) {
    if (type === 'gold') {
      const map: Record<number, string> = {
        10: '影子金币',
        50: '金叶币',
        100: '龙金币',
        1000: '黄金条',
        5000: '黄金砖',
      }
      return map[grams] || `黄金${grams}g`
    }

    const map: Record<number, string> = {
      10: '影子银币',
      50: '银叶币',
      100: '龙银币',
      1000: '白银条',
      5000: '白银砖',
    }
    return map[grams] || `白银${grams}g`
  }

  private getMetalImage(type: 'gold' | 'silver', grams: number) {
    const goldMap: Record<number, string> = {
      10: '/影子金币10g黄金.png',
      50: '/金叶币50g黄金.png',
      100: '/龙币100g黄金.png',
      1000: '/黄金条1000g黄金.png',
      5000: '/黄金砖5000g黄金.png',
    }
    const silverMap: Record<number, string> = {
      10: '/影子金币_银.jpg',
      50: '/金叶币50g白银.png',
      100: '/龙币100g白银.png',
      1000: '/黄金条1000g白银.jpg',
      5000: '/黄金砖5000g白银.png',
    }
    const map = type === 'gold' ? goldMap : silverMap
    return map[grams] || map[10]
  }

  private async getUserSilverHoldingGrams(userId: string) {
    const orders = await this.prisma.tradeOrder.findMany({
      where: {
        userId,
        assetCode: {
          startsWith: 'AG',
        },
        status: {
          notIn: [TradeStatus.CANCELLED, TradeStatus.REJECTED],
        },
      },
      select: {
        side: true,
        quantityGrams: true,
        filledGrams: true,
      },
    })

    let grams = 0
    orders.forEach((item) => {
      const base = toNumber(item.filledGrams) > 0 ? toNumber(item.filledGrams) : toNumber(item.quantityGrams)
      grams += item.side === 'BUY' ? base : -base
    })
    return Math.max(0, Number(grams.toFixed(4)))
  }

  private formatMoney(value: number) {
    return Number(value || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  private formatSignedMoney(value: number) {
    const normalized = Number(value || 0)
    const prefix = normalized > 0 ? '+' : normalized < 0 ? '-' : ''
    return `${prefix}${this.formatMoney(Math.abs(normalized))}`
  }

  private resolveLeaderboardLimit(input: unknown) {
    const parsed = Number(input)
    if (!Number.isFinite(parsed)) {
      return 10
    }

    const normalized = Math.trunc(parsed)
    if (normalized < 1) {
      return 10
    }

    return Math.min(normalized, 100)
  }

  private extractUidSequenceNo(uid: string) {
    const matchedDigits = String(uid || '').match(/(\d+)/)?.[1]
    if (!matchedDigits) {
      return Number.MAX_SAFE_INTEGER
    }

    const value = Number(matchedDigits)
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
  }

  private calculateStandardFeeAmount(amount: number) {
    return Number((Number(amount || 0) * STANDARD_FEE_RATE).toFixed(2))
  }

  private calculateP2pReceiverFeeAmount(amount: number) {
    const normalized = Number(amount || 0)
    if (normalized < P2P_FEE_FREE_THRESHOLD) {
      return 0
    }
    return Number((normalized * STANDARD_FEE_RATE).toFixed(2))
  }

  private async calculateYesterdayRealizedProfitFifo(
    userId: string,
    yesterdayStart: Date,
    todayStart: Date,
  ) {
    const orders = await this.prisma.tradeOrder.findMany({
      where: {
        userId,
        status: TradeStatus.FILLED,
        completedAt: {
          not: null,
          lt: todayStart,
        },
      },
      select: {
        side: true,
        assetCode: true,
        price: true,
        quantityGrams: true,
        filledGrams: true,
        completedAt: true,
      },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
    })

    const lotsByAsset = new Map<string, Array<{ grams: number; costPerGram: number }>>()
    let realizedPnl = 0

    for (const order of orders) {
      const assetCode = String(order.assetCode || '')
      if (!(assetCode.startsWith('AU') || assetCode.startsWith('AG'))) {
        continue
      }

      const price = toNumber(order.price)
      const filled = toNumber(order.filledGrams)
      const grams = filled > 0 ? filled : toNumber(order.quantityGrams)
      if (grams <= 0 || price <= 0) {
        continue
      }

      const lots = lotsByAsset.get(assetCode) || []

      if (order.side === TradeSide.BUY) {
        lots.push({ grams, costPerGram: price })
      }

      if (order.side === TradeSide.SELL) {
        let remaining = grams
        let matchedCost = 0

        while (remaining > 0) {
          const lot = lots[0]
          if (!lot) {
            // 缺失历史成本时按当笔成交价兜底，避免夸大利润
            matchedCost += remaining * price
            remaining = 0
            break
          }

          const take = Math.min(remaining, lot.grams)
          matchedCost += take * lot.costPerGram
          lot.grams -= take
          remaining -= take

          if (lot.grams <= 0) {
            lots.shift()
          }
        }

        if (order.completedAt && order.completedAt >= yesterdayStart && order.completedAt < todayStart) {
          const sellAmount = grams * price
          realizedPnl += sellAmount - matchedCost
        }
      }

      lotsByAsset.set(assetCode, lots)
    }

    return Number(realizedPnl.toFixed(2))
  }

  private mapGoldChainSyncStatus(syncStatus?: string) {
    if (syncStatus === 'SYNCED') {
      return 'synced'
    }
    if ((syncStatus || '').includes('FAIL')) {
      return 'failed'
    }
    return 'pending'
  }

  private mapGoldChainEventType(referenceType?: string) {
    const value = String(referenceType || '').toUpperCase()
    if (value.includes('TRADE')) {
      return 'trade'
    }
    if (value.includes('WITHDRAW')) {
      return 'withdrawal'
    }
    if (value.includes('RECHARGE')) {
      return 'recharge'
    }
    if (value.includes('PAYMENT')) {
      return 'payment'
    }
    return 'audit'
  }

  private resolveGoldChainPrimaryUserId(record: any) {
    return (
      record.tradeOrder?.user?.id ||
      record.withdrawalOrder?.user?.id ||
      record.rechargeOrder?.user?.id ||
      record.paymentOrder?.payee?.id ||
      record.paymentOrder?.payer?.id ||
      ''
    )
  }

  private async findUser(query: UserQueryDto) {
    const where = query.uid
      ? { uid: query.uid }
      : query.username
        ? { username: query.username }
        : undefined

    return this.prisma.user.findFirst({
      where,
      include: {
        asset: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
  }

  private async composeAdminUsersPayload(input: {
    query: AdminUsersQueryDto
    page: number
    pageSize: number
    users: Array<
      Prisma.UserGetPayload<{
        include: { asset: true }
      }>
    >
    total?: number
    selectedUserId?: string
    postFilter?: boolean
  }) {
    const sequenceMap = await this.buildUserSequenceMap()
    const userIds = input.users.map((item) => item.id)
    const bundles = await this.loadAdminUserRelationBundles(userIds)
    const marketPrices = await this.resolveMarketUnitPrices()

    let rowCandidates = await Promise.all(
      input.users.map(async (user) => {
        const recharges = bundles.rechargeByUserId.get(user.id) || []
        const withdrawals = bundles.withdrawByUserId.get(user.id) || []
        const metrics = await this.computeLiveAssetMetrics(user.id, user.asset, marketPrices)

        return {
          userId: user.id,
          uid: user.uid,
          sequenceNo: sequenceMap.get(user.id) || '-',
          nickname: user.nickname || user.username,
          realNameStatus: this.mapRealNameLabel(user.realNameStatus),
          rechargeStatus: this.mapRechargeLabel(recharges),
          withdrawStatus: this.mapWithdrawability(
            user.status,
            user.asset?.tentativeAsset,
            user.asset?.withdrawFrozenAmount,
          ),
          cashAsset: formatCurrency(metrics.cashAsset),
          goldHoldingGrams: formatGrams(metrics.goldGrams),
          totalAsset: formatCurrency(metrics.totalAsset),
          userStatus: this.mapUserStatus(user.status),
          _user: user,
        }
      }),
    )

    rowCandidates = rowCandidates
      .filter((item) => this.matchesSequenceNo(item.sequenceNo, input.query.sequenceNo))
      .filter((item) => this.matchesRechargeStatus(item.rechargeStatus, input.query.rechargeStatus))
      .filter((item) => this.matchesWithdrawStatus(item.withdrawStatus, input.query.withdrawStatus))

    const total = input.postFilter ? rowCandidates.length : input.total ?? rowCandidates.length
    const skip = (input.page - 1) * input.pageSize
    const pagedRows = input.postFilter ? rowCandidates.slice(skip, skip + input.pageSize) : rowCandidates

    if (!pagedRows.length) {
      return {
        rows: [],
        total,
        selectedUser: {},
        relatedRecords: { recharge: [], withdraw: [], trade: [], audit: [] },
      }
    }

    const selectedRow =
      pagedRows.find(
        (item) =>
          item.userId === input.selectedUserId ||
          item.uid === input.query.uid?.trim() ||
          item.userId === input.query.userId?.trim() ||
          item.sequenceNo === input.query.sequenceNo?.trim(),
      ) || pagedRows[0]
    const selectedUser = selectedRow._user
    const selectedRecharges = bundles.rechargeByUserId.get(selectedUser.id) || []
    const selectedWithdrawals = bundles.withdrawByUserId.get(selectedUser.id) || []
    const selectedTrades = bundles.tradeByUserId.get(selectedUser.id) || []
    const selectedAudits = bundles.auditByUserId.get(selectedUser.id) || []
    const selectedHashRecords = bundles.hashRecords.filter(
      (item) =>
        selectedRecharges.some((order) => order.id === item.rechargeOrderId) ||
        selectedWithdrawals.some((order) => order.id === item.withdrawalOrderId) ||
        selectedTrades.some((order) => order.id === item.tradeOrderId),
    )

    const selectedUserDetail = await this.buildAdminSelectedUserDetail(
      selectedUser,
      selectedWithdrawals,
      selectedRecharges,
      selectedTrades,
      selectedAudits,
      selectedHashRecords,
      input.query,
    )

    return {
      rows: pagedRows.map(({ _user: _ignored, ...item }) => item),
      total,
      selectedUser: selectedUserDetail,
      relatedRecords: {
        recharge: selectedRecharges.slice(0, 3).map((item) => {
          return `充值订单 ${item.id} / ${this.mapRechargeRecordStatus(item.status)} / ${formatDateTime(item.createdAt)}`
        }),
        withdraw: selectedWithdrawals.slice(0, 3).map((item: WithdrawalOrder) => {
          return `提现单 ${item.id} / ${this.mapWithdrawalRecordStatus(item.status)} / ${formatDateTime(item.submittedAt)}`
        }),
        trade: selectedTrades.slice(0, 3).map((item: TradeOrder) => {
          return `交易单 ${item.id} / ${item.side === 'BUY' ? '买入' : '卖出'} / ${this.mapTradeStatus(item.status)}`
        }),
        audit: selectedAudits.slice(0, 3).map((item) => {
          return `审计日志 ${item.traceId} / ${this.mapModuleLabel(item.module)} / ${this.mapAuditAction(item.action)}`
        }),
      },
    }
  }

  private async buildUserSequenceMap() {
    const orderedUsers = await this.prisma.user.findMany({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    const sequenceMap = new Map<string, string>()
    orderedUsers.forEach((user, index) => {
      sequenceMap.set(user.id, this.createSequenceNo(index + 1))
    })
    return sequenceMap
  }

  private async loadAdminUserRelationBundles(userIds: string[]) {
    if (!userIds.length) {
      return {
        rechargeByUserId: new Map<string, Awaited<ReturnType<PrismaService['rechargeOrder']['findMany']>>>(),
        withdrawByUserId: new Map<string, Awaited<ReturnType<PrismaService['withdrawalOrder']['findMany']>>>(),
        tradeByUserId: new Map<string, Awaited<ReturnType<PrismaService['tradeOrder']['findMany']>>>(),
        auditByUserId: new Map<string, Awaited<ReturnType<PrismaService['auditLog']['findMany']>>>(),
        hashRecords: [] as Awaited<ReturnType<PrismaService['hashRecord']['findMany']>>,
      }
    }

    const [rechargeOrders, withdrawalOrders, tradeOrders, auditLogs] = await Promise.all([
      this.prisma.rechargeOrder.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.withdrawalOrder.findMany({
        where: { userId: { in: userIds } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.tradeOrder.findMany({
        where: { userId: { in: userIds } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const hashRecords =
      rechargeOrders.length || withdrawalOrders.length || tradeOrders.length
        ? await this.prisma.hashRecord.findMany({
            where: {
              OR: [
                { rechargeOrderId: { in: unique(rechargeOrders.map((item) => item.id)) } },
                { withdrawalOrderId: { in: unique(withdrawalOrders.map((item) => item.id)) } },
                { tradeOrderId: { in: unique(tradeOrders.map((item) => item.id)) } },
              ],
            },
            orderBy: { createdAt: 'desc' },
          })
        : []

    const rechargeByUserId = new Map<string, typeof rechargeOrders>()
    const withdrawByUserId = new Map<string, typeof withdrawalOrders>()
    const tradeByUserId = new Map<string, typeof tradeOrders>()
    const auditByUserId = new Map<string, typeof auditLogs>()

    for (const item of rechargeOrders) {
      const rows = rechargeByUserId.get(item.userId) || []
      rows.push(item)
      rechargeByUserId.set(item.userId, rows)
    }
    for (const item of withdrawalOrders) {
      const rows = withdrawByUserId.get(item.userId) || []
      rows.push(item)
      withdrawByUserId.set(item.userId, rows)
    }
    for (const item of tradeOrders) {
      const rows = tradeByUserId.get(item.userId) || []
      rows.push(item)
      tradeByUserId.set(item.userId, rows)
    }
    for (const item of auditLogs) {
      if (!item.userId) {
        continue
      }
      const rows = auditByUserId.get(item.userId) || []
      rows.push(item)
      auditByUserId.set(item.userId, rows)
    }

    return {
      rechargeByUserId,
      withdrawByUserId,
      tradeByUserId,
      auditByUserId,
      hashRecords,
    }
  }

  private async buildAdminSelectedUserDetail(
    user: Prisma.UserGetPayload<{ include: { asset: true } }>,
    withdrawals: WithdrawalOrder[],
    recharges: Array<{ id: string; status: RechargeStatus; traceId: string; createdAt: Date }>,
    trades: TradeOrder[],
    audits: Array<{ id: string; module: string; action: string; traceId: string; createdAt: Date; payload: Prisma.JsonValue }>,
    hashRecords: Array<{ traceId: string; syncStatus: string }>,
    query: AdminUsersQueryDto = {},
  ) {
    const [registerLog, loginSessions, earliestLoginSession, earliestLoginAudit, paymentConfig] =
      await Promise.all([
        this.prisma.auditLog.findFirst({
          where: {
            userId: user.id,
            module: 'auth',
            action: 'register',
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.userLoginSession.findMany({
          where: { userId: user.id },
          orderBy: { lastSeenAt: 'desc' },
          take: 10,
        }),
        this.prisma.userLoginSession.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.auditLog.findFirst({
          where: {
            userId: user.id,
            module: 'auth',
            action: 'login',
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.systemConfig.findUnique({
          where: { configKey: this.paymentMethodConfigKey(user.id) },
        }),
      ])

    const registerPayload = getJsonRecord(registerLog?.payload)
    const metrics = await this.computeLiveAssetMetrics(user.id, user.asset)
    const paymentMethod = this.parsePaymentMethodConfig(paymentConfig?.configValue)
    const payoutMethods = paymentMethod
      ? [
          {
            type: paymentMethod.type,
            account: paymentMethod.account,
            bankName: paymentMethod.bankName,
            isDefault: true,
          },
        ]
      : []

    return {
      uid: user.uid,
      userId: user.id,
      userStatus: this.mapUserStatus(user.status),
      appreciationIncome: formatCurrency(toNumber(user.asset?.appreciationIncome)),
      payoutProfileSummary: this.buildPayoutProfileSummary(withdrawals),
      riskStatus: this.buildRiskStatus(user.status, withdrawals, hashRecords),
      lastTradeAt: formatDateTime(trades[0]?.submittedAt),
      latestTraceId:
        audits[0]?.traceId || trades[0]?.traceId || withdrawals[0]?.traceId || recharges[0]?.traceId || '-',
      registeredAt: formatDateTime(user.createdAt),
      registerChannel: String(registerPayload.registerChannel || '-'),
      registerIp: this.resolveAdminRegisterIp(registerPayload, earliestLoginSession, earliestLoginAudit),
      deviceModel: loginSessions[0]?.deviceName || '-',
      phone: user.phone || '-',
      realName: String(registerPayload.realName || user.nickname || user.username),
      idCard: this.resolveAdminIdNumber(registerPayload, audits),
      realNameStatus: this.mapRealNameLabel(user.realNameStatus),
      realNameVerifiedAt:
        user.realNameStatus === RealNameStatus.VERIFIED ? formatDateTime(user.updatedAt) : '-',
      payoutMethods,
      availableBalance: formatCurrency(metrics.availableBalance),
      frozenAmount: formatCurrency(metrics.withdrawFrozenAmount),
      holdingValue: formatCurrency(metrics.marketValue),
      totalProfit: formatCurrency(metrics.appreciationIncome),
      cashAsset: formatCurrency(metrics.cashAsset),
      goldHoldingGrams: formatGrams(metrics.goldGrams),
      totalAsset: formatCurrency(metrics.totalAsset),
      devices: loginSessions.map((item) => ({
        deviceId: item.id,
        deviceName: item.deviceName,
        ip: item.ipLast || '-',
        lastLoginAt: formatDateTime(item.lastSeenAt),
      })),
      ...(await this.loadUserOperationLogs(
        user.id,
        query.operationLogPage,
        query.operationLogPageSize,
      )),
    }
  }

  private async loadUserOperationLogs(userId: string, pageInput?: number, pageSizeInput?: number) {
    const page = Math.max(1, Number(pageInput) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeInput) || 10))
    const skip = (page - 1) * pageSize

    const where = { userId }
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      operationLogs: rows.map((item) => ({
        id: item.id,
        createdAt: formatDateTime(item.createdAt),
        action: this.mapAuditAction(item.action),
        detail: `${this.mapModuleLabel(item.module)} / ${item.traceId}`,
      })),
      operationLogsTotal: total,
      operationLogPage: page,
      operationLogPageSize: pageSize,
    }
  }

  /** 与 C 端 profile 一致：暂定资产 + 实时持仓市值 */
  private async resolveMarketUnitPrices(): Promise<MarketUnitPrices> {
    let goldPricePerGram = GOLD_UNIT_PRICE
    let silverPricePerGram = SILVER_UNIT_PRICE

    if (this.marketService) {
      const [goldResult, silverResult] = await Promise.allSettled([
        this.marketService.getTicker('AU9999'),
        this.marketService.getTicker('AG9999'),
      ])

      if (goldResult.status === 'fulfilled') {
        const price = Number(goldResult.value?.price)
        if (Number.isFinite(price) && price > 0) {
          goldPricePerGram = price
        }
      }
      if (silverResult.status === 'fulfilled') {
        const price = Number(silverResult.value?.price)
        if (Number.isFinite(price) && price > 0) {
          silverPricePerGram = price
        }
      }
    }

    return { goldPricePerGram, silverPricePerGram }
  }

  private async computeLiveAssetMetrics(
    userId: string,
    asset:
      | {
          tentativeAsset?: Prisma.Decimal | number | string | null
          cashAsset?: Prisma.Decimal | number | string | null
          goldHoldingGrams?: Prisma.Decimal | number | string | null
          appreciationIncome?: Prisma.Decimal | number | string | null
          withdrawFrozenAmount?: Prisma.Decimal | number | string | null
        }
      | null
      | undefined,
    prices?: MarketUnitPrices,
  ): Promise<LiveAssetMetrics> {
    const priceBundle = prices ?? (await this.resolveMarketUnitPrices())
    const goldGrams = toNumber(asset?.goldHoldingGrams)
    const silverGrams = await this.getUserSilverHoldingGrams(userId)
    const tentativeAsset = toNumber(asset?.tentativeAsset)
    const cashAsset = toNumber(asset?.cashAsset)
    const appreciationIncome = toNumber(asset?.appreciationIncome)
    const withdrawFrozenAmount = toNumber(asset?.withdrawFrozenAmount)
    const marketValue =
      goldGrams * priceBundle.goldPricePerGram + silverGrams * priceBundle.silverPricePerGram
    const availableBalance = Math.max(tentativeAsset, 0)
    const totalAsset = availableBalance + marketValue

    return {
      tentativeAsset,
      cashAsset,
      goldGrams,
      silverGrams,
      marketValue,
      availableBalance,
      totalAsset,
      appreciationIncome,
      withdrawFrozenAmount,
    }
  }

  /** 注册 IP：优先注册审计，其次首次登录审计 / 最早登录会话 */
  private resolveAdminRegisterIp(
    registerPayload: Record<string, unknown>,
    earliestLoginSession: { ipLast: string } | null,
    earliestLoginAudit: { payload: Prisma.JsonValue } | null,
  ) {
    const fromRegister = String(registerPayload.registerIp || registerPayload.ip || '').trim()
    if (fromRegister) {
      return fromRegister
    }

    const loginPayload = getJsonRecord(earliestLoginAudit?.payload)
    const fromLoginAudit = String(loginPayload.ip || '').trim()
    if (fromLoginAudit) {
      return fromLoginAudit
    }

    const fromSession = String(earliestLoginSession?.ipLast || '').trim()
    if (fromSession) {
      return fromSession
    }

    return '-'
  }

  /** 管理端展示完整身份证号：优先注册审计明文，兼容历史审计载荷 */
  private resolveAdminIdNumber(
    registerPayload: Record<string, unknown>,
    audits: Array<{ payload: Prisma.JsonValue }>,
  ) {
    const fromRegister = String(registerPayload.idNumber || '').trim()
    if (fromRegister) {
      return fromRegister
    }

    for (const item of audits) {
      const payload = getJsonRecord(item.payload)
      const idNumber = String(payload.idNumber || '').trim()
      if (idNumber) {
        return idNumber
      }
    }

    return '-'
  }

  private createSequenceNo(sequence: number) {
    return `S${String(sequence).padStart(8, '0')}`
  }

  private mapRealNameLabel(status: RealNameStatus) {
    if (status === RealNameStatus.VERIFIED) {
      return '已实名'
    }
    if (status === RealNameStatus.REJECTED) {
      return '实名驳回'
    }
    return '待实名'
  }

  private mapRechargeLabel(items: Array<{ status: RechargeStatus }>) {
    if (items.length === 0) {
      return '未充值'
    }
    return items.some((item) => item.status === RechargeStatus.COMPLETED) ? '已充值' : '处理中'
  }

  private mapWithdrawability(
    status: UserStatus,
    tentativeAsset?: Prisma.Decimal | number | string | null,
    withdrawFrozenAmount?: Prisma.Decimal | number | string | null,
  ) {
    const totalAvailable = toNumber(tentativeAsset) + toNumber(withdrawFrozenAmount)
    if (status !== UserStatus.ACTIVE) {
      return '不可提现'
    }
    return totalAvailable > 0 ? '可提现' : '不可提现'
  }

  private mapUserStatus(status: UserStatus) {
    if (status === UserStatus.FROZEN) {
      return '冻结'
    }
    if (status === UserStatus.DISABLED) {
      return '停用'
    }
    return '正常'
  }

  private buildRealNameWhere(status: string) {
    const normalized = status.toLowerCase()
    if (['passed', 'verified', '已实名'].includes(normalized)) {
      return { realNameStatus: RealNameStatus.VERIFIED }
    }
    if (['pending', '待实名'].includes(normalized)) {
      return { realNameStatus: RealNameStatus.PENDING }
    }
    if (['rejected', '实名驳回'].includes(normalized)) {
      return { realNameStatus: RealNameStatus.REJECTED }
    }
    return {}
  }

  private matchesSequenceNo(sequenceNo: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }
    return sequenceNo.toLowerCase().includes(queryValue.toLowerCase())
  }

  private matchesRechargeStatus(status: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (['passed', 'verified'].includes(normalized)) {
      return status === '已充值'
    }
    if (['pending'].includes(normalized)) {
      return status !== '已充值'
    }
    if (['recharged', 'enabled', '已充值'].includes(normalized)) {
      return status === '已充值'
    }
    if (['unrecharged', '未充值'].includes(normalized)) {
      return status === '未充值'
    }
    return status.includes(queryValue)
  }

  private matchesWithdrawStatus(status: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (['enabled', 'allowed', '可提现'].includes(normalized)) {
      return status === '可提现'
    }
    if (['disabled', 'blocked', '不可提现'].includes(normalized)) {
      return status === '不可提现'
    }
    return status.includes(queryValue)
  }

  private buildPayoutProfileSummary(
    withdrawals: Array<{
      bankName: string | null
      bankAccountNo: string | null
      alipayReceiptUrl: string | null
      wechatReceiptUrl: string | null
    }>,
  ) {
    const labels = new Set<string>()
    for (const item of withdrawals) {
      if (item.bankName || item.bankAccountNo) {
        labels.add('银行卡')
      }
      if (item.alipayReceiptUrl) {
        labels.add('支付宝')
      }
      if (item.wechatReceiptUrl) {
        labels.add('微信')
      }
    }

    if (!labels.size) {
      return '暂无收款信息'
    }

    return `${Array.from(labels).join(' + ')}已校验`
  }

  private buildRiskStatus(
    status: UserStatus,
    withdrawals: Array<{ status: WithdrawalStatus }>,
    hashRecords: Array<{ traceId: string; syncStatus: string }>,
  ) {
    if (status === UserStatus.FROZEN) {
      return '高风险'
    }

    if (withdrawals.some((item) => item.status === WithdrawalStatus.PENDING || item.status === WithdrawalStatus.REVIEWING)) {
      return '中风险'
    }

    if (hashRecords.some((item) => item.syncStatus !== 'SYNCED')) {
      return '关注'
    }

    return '低风险'
  }

  private mapRechargeRecordStatus(status: RechargeStatus) {
    if (status === RechargeStatus.COMPLETED) {
      return '已到账'
    }
    if (status === RechargeStatus.FAILED) {
      return '异常'
    }
    return '处理中'
  }

  private mapWithdrawalRecordStatus(status: WithdrawalStatus) {
    if (status === WithdrawalStatus.COMPLETED) {
      return '已完成'
    }
    if (status === WithdrawalStatus.REJECTED) {
      return '已拒绝'
    }
    if (status === WithdrawalStatus.REVIEWING || status === WithdrawalStatus.APPROVED) {
      return '处理中'
    }
    return '待审核'
  }

  private mapTradeStatus(status: string) {
    if (status === 'FILLED') {
      return '成功'
    }
    if (status === 'REJECTED' || status === 'CANCELLED') {
      return '失败'
    }
    return '处理中'
  }

  private mapModuleLabel(module: string) {
    const mapping: Record<string, string> = {
      fund: '资金管理',
      trade: '交易管理',
      risk: '权限与风控',
      audit: '审计追溯',
      report: '报表中心',
    }
    return mapping[module] || module
  }

  private mapAuditAction(action: string) {
    if (action.startsWith('recharge')) {
      return '充值相关'
    }
    if (action.startsWith('withdraw')) {
      return '提现相关'
    }
    if (action.startsWith('trade')) {
      return '交易相关'
    }

    const payload = getJsonRecord({ action })
    return typeof payload.action === 'string' ? payload.action : action
  }
}
