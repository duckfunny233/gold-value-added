import { Injectable } from '@nestjs/common'
import { TradeStatus, WithdrawalStatus } from '@prisma/client'
import {
  formatCurrency,
  formatDateTime,
  formatGrams,
  formatInteger,
  formatPercent,
  resolveAdminTimeRange,
  toNumber,
} from '../../common/utils/admin-view.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminReportsQueryDto } from './report.dto'

const WITHDRAW_AUDIT_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.PENDING,
  WithdrawalStatus.REVIEWING,
  WithdrawalStatus.APPROVED,
]

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminReports(query: AdminReportsQueryDto) {
    const range = resolveAdminTimeRange(query.timeRange)

    const [users, trades, recharges, withdrawals, hashes, adminLogs] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' } } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.tradeOrder.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.rechargeOrder.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
          ...(query.channel ? { channel: query.channel } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.withdrawalOrder.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
          ...(query.channel ? this.buildWithdrawalChannelFilter(query.channel) : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.hashRecord.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.adminOperationLog.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          module: {
            in: ['report', 'fund', 'risk', 'trade'],
          },
        },
        include: {
          adminUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      }),
    ])

    const filledTrades = trades.filter((item) => item.status === TradeStatus.FILLED)
    const tradeVolume = filledTrades.reduce((sum, item) => sum + toNumber(item.quantityGrams), 0)
    const tradeAmount = filledTrades.reduce(
      (sum, item) => sum + toNumber(item.quantityGrams) * toNumber(item.price),
      0,
    )
    const fundFlowAmount =
      recharges.reduce((sum, item) => sum + toNumber(item.amount), 0) +
      withdrawals.reduce((sum, item) => sum + toNumber(item.amount), 0)
    const withdrawAuditCount = withdrawals.filter((item) => WITHDRAW_AUDIT_STATUSES.includes(item.status)).length
    const syncExceptionCount = hashes.filter((item) => item.syncStatus !== 'SYNCED').length

    const metrics = [
      users.length,
      tradeVolume,
      tradeAmount,
      fundFlowAmount,
      withdrawAuditCount,
      syncExceptionCount,
    ]
    const maxMetric = Math.max(...metrics, 1)

    return {
      cards: [
        {
          key: 'userGrowth',
          label: '用户增长数',
          value: formatInteger(users.length),
          rate: formatPercent((users.length / maxMetric) * 100),
        },
        {
          key: 'tradeVolume',
          label: '成交总克数',
          value: formatGrams(tradeVolume),
          rate: formatPercent((tradeVolume / maxMetric) * 100),
        },
        {
          key: 'tradeAmount',
          label: '成交总金额',
          value: formatCurrency(tradeAmount),
          rate: formatPercent((tradeAmount / maxMetric) * 100),
        },
        {
          key: 'fundFlowAmount',
          label: '资金流水金额',
          value: formatCurrency(fundFlowAmount),
          rate: formatPercent((fundFlowAmount / maxMetric) * 100),
        },
        {
          key: 'withdrawAuditCount',
          label: '提现审核笔数',
          value: formatInteger(withdrawAuditCount),
          rate: formatPercent((withdrawAuditCount / maxMetric) * 100),
        },
        {
          key: 'syncExceptionCount',
          label: '同步异常笔数',
          value: formatInteger(syncExceptionCount),
          rate: formatPercent((syncExceptionCount / maxMetric) * 100),
        },
      ],
      exportsList: this.buildExportsList(query.reportType, query.timeRange, adminLogs, {
        users,
        trades,
        recharges,
        withdrawals,
        hashes,
      }),
    }
  }

  getOverview() {
    return {
      todayRechargeAmount: 128000,
      todayWithdrawAmount: 43000,
      todayTradeVolumeGrams: 552.4,
      totalUsers: 1288,
    }
  }

  private buildExportsList(
    reportType: string | undefined,
    timeRange: string | undefined,
    logs: Array<{
      action: string
      createdAt: Date
      payload: unknown
      adminUser: { username: string; displayName: string | null } | null
    }>,
    datasets: {
      users: Array<{ createdAt: Date }>
      trades: Array<{ createdAt: Date; status: TradeStatus }>
      recharges: Array<{ createdAt: Date }>
      withdrawals: Array<{ createdAt: Date; status: WithdrawalStatus }>
      hashes: Array<{ createdAt: Date; syncStatus: string }>
    },
  ) {
    const normalizedType = (reportType || 'operate').toLowerCase()
    const templates =
      normalizedType === 'finance'
        ? [
            { name: '财务日报', modules: '资金/审计' },
            { name: '渠道对账表', modules: '资金/支付渠道' },
            { name: '提现审核表', modules: '资金/风控' },
          ]
        : normalizedType === 'risk'
          ? [
              { name: '风控追踪表', modules: '风控/交易' },
              { name: '冻结拦截表', modules: '风控/用户' },
              { name: '审计追溯表', modules: '风控/审计' },
            ]
          : [
              { name: '运营周报', modules: '用户/交易/资金' },
              { name: '交易活跃报表', modules: '交易/资金' },
              { name: '用户增长快照', modules: '用户/运营' },
            ]

    const latestLog = logs[0]
    const generatedBy =
      latestLog?.adminUser?.displayName || latestLog?.adminUser?.username || '系统'
    const aggregationRule = this.mapAggregationRule(timeRange)
    const latestCreatedAt = [
      datasets.users[0]?.createdAt,
      datasets.trades[0]?.createdAt,
      datasets.recharges[0]?.createdAt,
      datasets.withdrawals[0]?.createdAt,
      datasets.hashes[0]?.createdAt,
      latestLog?.createdAt,
    ]
      .filter((item): item is Date => Boolean(item))
      .sort((left, right) => right.getTime() - left.getTime())[0]

    const pendingHashes = datasets.hashes.some((item) => item.syncStatus !== 'SYNCED')
    const pendingWithdrawals = datasets.withdrawals.some((item) => WITHDRAW_AUDIT_STATUSES.includes(item.status))

    return templates.map((item, index) => ({
      name: item.name,
      generatedAt: formatDateTime(latestCreatedAt || null),
      generatedBy,
      aggregationRule,
      dataSourceModules: item.modules,
      status:
        index === 0 && (pendingHashes || pendingWithdrawals) && normalizedType !== 'operate'
          ? '生成中'
          : '已完成',
    }))
  }

  private mapAggregationRule(timeRange?: string) {
    if (timeRange === '30d') {
      return '按月汇总'
    }
    if (timeRange === 'today') {
      return '按日汇总'
    }
    return '按周汇总'
  }

  private buildWithdrawalChannelFilter(channel: string) {
    if (channel === 'wechat') {
      return { wechatReceiptUrl: { not: null } }
    }
    if (channel === 'alipay') {
      return { alipayReceiptUrl: { not: null } }
    }
    if (channel === 'bank') {
      return {
        OR: [{ bankName: { not: null } }, { bankAccountNo: { not: null } }],
      }
    }
    return {}
  }
}
