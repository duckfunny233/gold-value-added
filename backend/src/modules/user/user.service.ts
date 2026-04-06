import { Injectable, NotFoundException } from '@nestjs/common'
import {
  Prisma,
  RealNameStatus,
  RechargeStatus,
  TradeOrder,
  UserStatus,
  WithdrawalOrder,
  WithdrawalStatus,
} from '@prisma/client'
import {
  formatCurrency,
  formatDateTime,
  formatGrams,
  getJsonRecord,
  resolveAdminTimeRange,
  toNumber,
  unique,
} from '../../common/utils/admin-view.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminUsersQueryDto, UserQueryDto } from './user.dto'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

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
    const users = await this.prisma.user.findMany({
      where: {
        ...(query.userId ? { id: { contains: query.userId } } : {}),
        ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' } } : {}),
        ...(query.realNameStatus ? this.buildRealNameWhere(query.realNameStatus) : {}),
        ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
      },
      include: {
        asset: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
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
    return items.some((item) => item.status === RechargeStatus.COMPLETED) ? '已充值' : '充值处理中'
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
