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

    return {
      uid: user.uid,
      username: user.username,
      tentativeAsset: toNumber(user.asset.tentativeAsset),
      cashAsset: toNumber(user.asset.cashAsset),
      appreciationIncome: toNumber(user.asset.appreciationIncome),
      goldHoldingGrams: toNumber(user.asset.goldHoldingGrams),
      withdrawFrozenAmount: toNumber(user.asset.withdrawFrozenAmount),
      totalAsset: toNumber(user.asset.totalAsset),
      updatedAt: user.asset.updatedAt,
    }
  }

  async getAppProfile(query: UserQueryDto = {}) {
    const user = await this.resolveAppUser(query)
    const asset = user.asset
    const goldGrams = toNumber(asset?.goldHoldingGrams)
    const silverGrams = await this.getUserSilverHoldingGrams(user.id)
    const tentativeAsset = toNumber(asset?.tentativeAsset)
    const appreciationIncome = toNumber(asset?.appreciationIncome)
    const withdrawFrozenAmount = toNumber(asset?.withdrawFrozenAmount)

    const userAvatar =
      user.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.uid)}`

    // 使用真实行情计算持仓市值；失败时回退到常量基准价，避免页面不可用
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

    const marketValue = goldGrams * goldPricePerGram + silverGrams * silverPricePerGram

    // 业务口径：
    // 1) 暂定资产 = 充值/支付资金沉淀，不随金价波动
    // 2) 持仓市值 = 实时行情价 * 持仓克数
    // 3) 总资产 = 暂定资产 + 持仓市值
    const availableBalance = Math.max(tentativeAsset, 0)
    const totalAsset = availableBalance + marketValue

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
    const where: Prisma.UserWhereInput = {
      ...(query.userId ? { id: { contains: query.userId } } : {}),
      ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' as const } } : {}),
      ...(query.realNameStatus ? this.buildRealNameWhere(query.realNameStatus) : {}),
      ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
    }

    const total = await this.prisma.user.count({ where })

    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const skip = (page - 1) * pageSize

    const users = await this.prisma.user.findMany({
      where,
      include: {
        asset: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: pageSize,
    })

    if (!users.length) {
      return {
        rows: [],
        selectedUser: {},
        relatedRecords: { recharge: [], withdraw: [], trade: [], audit: [] },
      }
    }

    const userIds = users.map((item) => item.id)
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

    const rows = users
      .map((user, index) => {
        const recharges = rechargeByUserId.get(user.id) || []
        const withdrawals = withdrawByUserId.get(user.id) || []

        return {
          userId: user.id,
          uid: user.uid,
          sequenceNo: this.createSequenceNo(index + 1),
          nickname: user.nickname || user.username,
          realNameStatus: this.mapRealNameLabel(user.realNameStatus),
          rechargeStatus: this.mapRechargeLabel(recharges),
          withdrawStatus: this.mapWithdrawability(user.status, user.asset?.tentativeAsset, user.asset?.withdrawFrozenAmount),
          cashAsset: formatCurrency(toNumber(user.asset?.cashAsset)),
          goldHoldingGrams: formatGrams(toNumber(user.asset?.goldHoldingGrams)),
          totalAsset: formatCurrency(toNumber(user.asset?.totalAsset)),
          userStatus: this.mapUserStatus(user.status),
          _user: user,
        }
      })
      .filter((item) => this.matchesSequenceNo(item.sequenceNo, query.sequenceNo))
      .filter((item) => this.matchesRechargeStatus(item.rechargeStatus, query.rechargeStatus))
      .filter((item) => this.matchesWithdrawStatus(item.withdrawStatus, query.withdrawStatus))

    if (!rows.length) {
      return {
        rows: [],
        total,
        selectedUser: {},
        relatedRecords: { recharge: [], withdraw: [], trade: [], audit: [] },
      }
    }

    const selectedRow =
      rows.find((item) => item.uid === query.uid || item.userId === query.userId || item.sequenceNo === query.sequenceNo) ||
      rows[0]
    const selectedUser = selectedRow._user
    const selectedRecharges = rechargeByUserId.get(selectedUser.id) || []
    const selectedWithdrawals = withdrawByUserId.get(selectedUser.id) || []
    const selectedTrades = tradeByUserId.get(selectedUser.id) || []
    const selectedAudits = auditByUserId.get(selectedUser.id) || []

    return {
      rows: rows.map(({ _user: _ignored, ...item }) => item),
      total,
      selectedUser: {
        uid: selectedUser.uid,
          appreciationIncome: formatCurrency(toNumber(selectedUser.asset?.appreciationIncome)),
          payoutProfileSummary: this.buildPayoutProfileSummary(selectedWithdrawals),
          riskStatus: this.buildRiskStatus(
            selectedUser.status,
            selectedWithdrawals,
            hashRecords.filter((item) =>
              selectedRecharges.some((order) => order.id === item.rechargeOrderId) ||
              selectedWithdrawals.some((order) => order.id === item.withdrawalOrderId) ||
              selectedTrades.some((order) => order.id === item.tradeOrderId),
            ),
          ),
          lastTradeAt: formatDateTime(selectedTrades[0]?.submittedAt),
        latestTraceId:
          selectedAudits[0]?.traceId ||
          selectedTrades[0]?.traceId ||
          selectedWithdrawals[0]?.traceId ||
          selectedRecharges[0]?.traceId ||
          '-',
      },
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
