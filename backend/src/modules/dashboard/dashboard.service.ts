import { Injectable, NotFoundException } from '@nestjs/common'
import {
  NoticeStatus,
  Prisma,
  RechargeStatus,
  TradeStatus,
  UserStatus,
  WithdrawalStatus,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  DEFAULT_LOCAL_NOTICE,
  DASHBOARD_RULE_REMINDERS,
  MODULE_LABELS,
  NOTICE_STATUS_LABELS,
} from './dashboard.constants'
import { DashboardQueryDto, PublishNoticeDto } from './dashboard.dto'
import {
  DashboardEvent,
  DashboardMonitor,
  DashboardPendingRow,
  DashboardStat,
  NoticeFeedResult,
  UnifiedNotice,
} from './dashboard.types'
import { formatDateTime, formatTime, trimText } from './dashboard.utils'
import { NewsFeedService } from './news-feed.service'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { MarketService } from '../market/market.service'

type AdminActor = {
  adminUserId: string
  username: string
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly newsFeedService: NewsFeedService,
    private readonly marketService: MarketService,
  ) {}

  async getDashboard(query: DashboardQueryDto) {
    const [stats, pendingRows, events, monitors, localAdminNotices, remoteFeed] = await Promise.all([
      this.buildStats(query),
      this.buildPendingRows(query),
      this.buildEvents(query),
      this.buildMonitors(query),
      this.getAdminLocalNotices(),
      this.safeGetRemoteFeed(),
    ])

    const notices = this.resolveAdminNotices(remoteFeed, localAdminNotices)

    return {
      data: {
        stats,
        pendingRows: pendingRows.map(({ sortTimestamp: _sortTimestamp, ...item }) => item),
        notices: notices.notices.map(({ sortTimestamp: _sortTimestamp, ...item }) => item),
        events: events.map(({ sortTimestamp: _sortTimestamp, ...item }) => item),
        monitors,
        ruleReminders: DASHBOARD_RULE_REMINDERS,
        noticeMeta: notices.meta,
      },
      meta: notices.meta,
    }
  }

  async getAppNoticeFeed(): Promise<NoticeFeedResult> {
    const [remoteFeed, localNotices] = await Promise.all([
      this.safeGetRemoteFeed(),
      this.getPublishedLocalNotices(),
    ])

    if (remoteFeed.notices.length) {
      return {
        notices: this.mergeNotices(remoteFeed.notices, localNotices),
        meta: remoteFeed.meta,
      }
    }

    if (localNotices.length) {
      return {
        notices: localNotices,
        meta: {
          source: 'local',
          code: remoteFeed.meta.code,
          cachedAt: remoteFeed.meta.cachedAt,
        },
      }
    }

    return {
      notices: [this.buildDefaultLocalNotice()],
      meta: {
        source: 'default-local',
        code: remoteFeed.meta.code,
        cachedAt: remoteFeed.meta.cachedAt,
      },
    }
  }

  async publishNotice(body: PublishNoticeDto, actor: AdminActor) {
    const traceId = randomUUID()
    const created = await this.prisma.$transaction(async (tx) => {
      const notice = await tx.notice.create({
        data: {
          title: body.title.trim(),
          content: body.content.trim(),
          sortOrder: body.sortOrder ?? 0,
          status: NoticeStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      await this.writeNoticeLogs(tx, {
        actor,
        action: 'dashboard.notice.publish',
        traceId,
        referenceType: 'NOTICE_PUBLISH',
        referenceId: notice.id,
        payload: {
          noticeId: notice.id,
          title: notice.title,
          status: notice.status,
          result: '成功',
        } as Prisma.InputJsonValue,
      })

      return notice
    })

    return {
      id: created.id,
      title: created.title,
      content: created.content,
      status: NOTICE_STATUS_LABELS[created.status],
      publishAt: formatDateTime(created.publishedAt),
      pollingEnabled: '是',
    }
  }

  async updateNotice(
    noticeId: string,
    body: { title: string; content: string; sortOrder?: number },
    actor: AdminActor,
  ) {
    const existing = await this.prisma.notice.findUnique({
      where: {
        id: noticeId,
      },
    })

    if (!existing) {
      throw new NotFoundException('公告不存在')
    }

    const traceId = randomUUID()
    const updated = await this.prisma.$transaction(async (tx) => {
      const notice = await tx.notice.update({
        where: {
          id: noticeId,
        },
        data: {
          title: body.title.trim(),
          content: body.content.trim(),
          ...(typeof body.sortOrder === 'number' ? { sortOrder: body.sortOrder } : {}),
        },
      })

      await this.writeNoticeLogs(tx, {
        actor,
        action: 'dashboard.notice.update',
        traceId,
        referenceType: 'NOTICE_UPDATE',
        referenceId: notice.id,
        payload: {
          noticeId: notice.id,
          before: {
            title: existing.title,
            content: existing.content,
            sortOrder: existing.sortOrder,
          },
          after: {
            title: notice.title,
            content: notice.content,
            sortOrder: notice.sortOrder,
          },
          result: '成功',
        } as Prisma.InputJsonValue,
      })

      return notice
    })

    return {
      id: updated.id,
      title: updated.title,
      content: updated.content,
      status: NOTICE_STATUS_LABELS[updated.status],
      publishAt: formatDateTime(updated.publishedAt),
      pollingEnabled: updated.status === NoticeStatus.PUBLISHED ? '是' : '否',
    }
  }

  async deleteNotice(noticeId: string, actor: AdminActor) {
    const existing = await this.prisma.notice.findUnique({
      where: {
        id: noticeId,
      },
    })

    if (!existing) {
      throw new NotFoundException('公告不存在')
    }

    const traceId = randomUUID()
    await this.prisma.$transaction(async (tx) => {
      await tx.notice.delete({
        where: {
          id: noticeId,
        },
      })

      await this.writeNoticeLogs(tx, {
        actor,
        action: 'dashboard.notice.delete',
        traceId,
        referenceType: 'NOTICE_DELETE',
        referenceId: noticeId,
        payload: {
          noticeId,
          title: existing.title,
          result: '成功',
        } as Prisma.InputJsonValue,
      })
    })

    return {
      id: noticeId,
      deleted: true,
      traceId,
    }
  }

  private async buildStats(query: DashboardQueryDto): Promise<DashboardStat[]> {
    const range = this.resolveDateRange(query.date)

    const [pendingWithdrawals, pendingRecharges, frozenUsers, goldReference, openTrades] =
      await Promise.all([
        this.prisma.withdrawalOrder.count({
          where: {
            status: {
              in: [WithdrawalStatus.PENDING, WithdrawalStatus.REVIEWING, WithdrawalStatus.APPROVED],
            },
            createdAt: range,
          },
        }),
        this.prisma.rechargeOrder.count({
          where: {
            status: {
              in: [RechargeStatus.PENDING, RechargeStatus.PROCESSING],
            },
            createdAt: range,
          },
        }),
        this.prisma.user.count({
          where: {
            status: UserStatus.FROZEN,
          },
        }),
        this.marketService.getTicker('AU9999'),
        this.prisma.tradeOrder.count({
          where: {
            status: {
              in: [TradeStatus.OPEN, TradeStatus.PARTIALLY_FILLED, TradeStatus.FILLED],
            },
            createdAt: range,
          },
        }),
      ])

    const pendingCount = pendingWithdrawals + pendingRecharges
    const livePrice = Number(goldReference.price).toFixed(2)

    return [
      {
        label: '待审核单据',
        value: `${pendingCount}笔`,
        note: `提现 ${pendingWithdrawals} 笔 / 充值 ${pendingRecharges} 笔`,
      },
      {
        label: '冻结用户数',
        value: `${frozenUsers}人`,
        note: '风控与提现双拦截已生效',
      },
      {
        label: '黄金参考价',
        value: `¥${livePrice}/克`,
        note: `来自 gold-api.com 实时接口，更新于 ${goldReference.updatedAtReadable || goldReference.timestamp}`,
      },
      {
        label: '交易状态',
        value: openTrades > 0 ? '运行中' : '待观察',
        note: openTrades > 0 ? '当前仍有订单流转中' : '当前时间范围内暂无活跃订单',
      },
    ]
  }

  private async buildPendingRows(query: DashboardQueryDto) {
    const range = this.resolveDateRange(query.date)

    const [withdrawals, recharges, frozenUsers, hashRecords] = await Promise.all([
      this.prisma.withdrawalOrder.findMany({
        where: {
          status: {
            in: [WithdrawalStatus.PENDING, WithdrawalStatus.REVIEWING, WithdrawalStatus.APPROVED],
          },
          createdAt: range,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),
      this.prisma.rechargeOrder.findMany({
        where: {
          status: {
            in: [RechargeStatus.PENDING, RechargeStatus.PROCESSING],
          },
          createdAt: range,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),
      this.prisma.user.findMany({
        where: {
          status: UserStatus.FROZEN,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 3,
      }),
      this.prisma.hashRecord.findMany({
        where: {
          OR: [{ syncedAt: null }, { syncStatus: { not: 'SYNCED' } }],
          createdAt: range,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3,
      }),
    ])

    const rows: DashboardPendingRow[] = [
      ...withdrawals.map((item) => ({
        id: item.id,
        module: MODULE_LABELS.funds,
        name: '提现审核',
        owner: '财务',
        level: '高' as const,
        time: formatTime(item.createdAt),
        sortTimestamp: item.createdAt.getTime(),
      })),
      ...recharges.map((item) => ({
        id: item.id,
        module: MODULE_LABELS.funds,
        name: item.status === RechargeStatus.PROCESSING ? '充值补单确认' : '充值到账复核',
        owner: '财务',
        level: '中' as const,
        time: formatTime(item.createdAt),
        sortTimestamp: item.createdAt.getTime(),
      })),
      ...frozenUsers.map((item) => ({
        id: item.uid,
        module: MODULE_LABELS.risk,
        name: '冻结复核',
        owner: '风控',
        level: '中' as const,
        time: formatTime(item.updatedAt),
        sortTimestamp: item.updatedAt.getTime(),
      })),
      ...hashRecords.map((item) => ({
        id: item.traceId,
        module: MODULE_LABELS.audit,
        name: '哈希同步复核',
        owner: '审计',
        level: '低' as const,
        time: formatTime(item.createdAt),
        sortTimestamp: item.createdAt.getTime(),
      })),
    ]

    return this.filterPendingRows(rows, query)
  }

  private async buildEvents(query: DashboardQueryDto) {
    const range = this.resolveDateRange(query.date)

    const [auditLogs, adminLogs] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          createdAt: range,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 6,
      }),
      this.prisma.adminOperationLog.findMany({
        where: {
          createdAt: range,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 6,
      }),
    ])

    const events: DashboardEvent[] = [
      ...auditLogs.map((item) => ({
        traceId: item.traceId,
        module: item.module,
        detail: `${item.action} (${item.actorType})`,
        time: formatTime(item.createdAt),
        sortTimestamp: item.createdAt.getTime(),
      })),
      ...adminLogs.map((item) => ({
        traceId: item.traceId,
        module: item.module,
        detail: item.action,
        time: formatTime(item.createdAt),
        sortTimestamp: item.createdAt.getTime(),
      })),
    ]

    return events
      .filter((item) => this.matchesModule(item.module, query.module))
      .sort((left, right) => right.sortTimestamp - left.sortTimestamp)
      .slice(0, 6)
  }

  private async buildMonitors(query: DashboardQueryDto): Promise<DashboardMonitor[]> {
    const range = this.resolveDateRange(query.date)

    const [hashRecords, rechargeTotal, rechargeCompleted] = await Promise.all([
      this.prisma.hashRecord.findMany({
        where: {
          syncedAt: {
            not: null,
          },
          createdAt: range,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
        select: {
          createdAt: true,
          syncedAt: true,
        },
      }),
      this.prisma.rechargeOrder.count({
        where: {
          createdAt: range,
        },
      }),
      this.prisma.rechargeOrder.count({
        where: {
          status: RechargeStatus.COMPLETED,
          createdAt: range,
        },
      }),
    ])

    const syncDelaySeconds =
      hashRecords.length === 0
        ? 0
        : hashRecords.reduce((sum, item) => {
            const syncedAt = item.syncedAt ?? item.createdAt
            return sum + Math.max(0, syncedAt.getTime() - item.createdAt.getTime())
          }, 0) /
          hashRecords.length /
          1000

    const reconcileRate = rechargeTotal === 0 ? 100 : Math.round((rechargeCompleted / rechargeTotal) * 100)

    return [
      {
        key: 'syncDelay',
        label: '同步延迟',
        value:
          hashRecords.length === 0
            ? '暂无链路样本，默认按正常状态展示'
            : `${syncDelaySeconds.toFixed(1)} 秒，处于${syncDelaySeconds <= 5 ? '正常' : '关注'}阈值内`,
      },
      {
        key: 'leaderboardRebuildStatus',
        label: '排行榜重建状态',
        value: '当前未接入独立重排任务，按聚合结果正常展示',
      },
      {
        key: 'paymentReconcileStatus',
        label: '支付对账状态',
        value: `充值完成率 ${reconcileRate}%`,
      },
    ]
  }

  private async getAdminLocalNotices() {
    const notices = await this.prisma.notice.findMany({
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
    })

    return notices.map((item) => this.mapLocalNotice(item))
  }

  private async getPublishedLocalNotices() {
    const notices = await this.prisma.notice.findMany({
      where: {
        status: NoticeStatus.PUBLISHED,
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
    })

    return notices.map((item) => this.mapLocalNotice(item))
  }

  private mapLocalNotice(notice: {
    id: string
    title: string
    content: string
    status: NoticeStatus
    publishedAt: Date | null
    updatedAt: Date
  }): UnifiedNotice {
    return {
      id: notice.id,
      title: notice.title,
      content: trimText(notice.content, 180),
      text: trimText(notice.content, 180) || notice.title,
      status: NOTICE_STATUS_LABELS[notice.status],
      publishAt: formatDateTime(notice.publishedAt),
      pollingEnabled: notice.status === NoticeStatus.PUBLISHED ? '是' : '否',
      source: 'local',
      publishedAtIso: notice.publishedAt?.toISOString() ?? null,
      sortTimestamp: notice.publishedAt?.getTime() ?? notice.updatedAt.getTime(),
    }
  }

  private resolveAdminNotices(remoteFeed: NoticeFeedResult, localNotices: UnifiedNotice[]) {
    if (remoteFeed.notices.length) {
      return {
        notices: this.mergeNotices(remoteFeed.notices, localNotices),
        meta: remoteFeed.meta,
      }
    }

    if (localNotices.length) {
      return {
        notices: localNotices,
        meta: {
          source: 'local',
          code: remoteFeed.meta.code,
          cachedAt: remoteFeed.meta.cachedAt,
        },
      }
    }

    return {
      notices: [this.buildDefaultLocalNotice()],
      meta: {
        source: 'default-local',
        code: remoteFeed.meta.code,
        cachedAt: remoteFeed.meta.cachedAt,
      },
    }
  }

  private async safeGetRemoteFeed(): Promise<NoticeFeedResult> {
    try {
      return await this.newsFeedService.getFeed()
    } catch (error) {
      return {
        notices: [],
        meta: {
          source: 'disabled',
          code: 'NEWS_FETCH_FAILED',
          cachedAt: formatDateTime(new Date()),
        },
      }
    }
  }

  private mergeNotices(...groups: UnifiedNotice[][]) {
    const seen = new Set<string>()

    return groups
      .flat()
      .sort((left, right) => right.sortTimestamp - left.sortTimestamp)
      .filter((item) => {
        const uniqueKey = `${item.source}:${item.title}:${item.publishAt}`
        if (seen.has(uniqueKey)) {
          return false
        }

        seen.add(uniqueKey)
        return true
      })
      .slice(0, 10)
  }

  private buildDefaultLocalNotice(): UnifiedNotice {
    return {
      id: 'default_notice',
      title: DEFAULT_LOCAL_NOTICE.title,
      content: DEFAULT_LOCAL_NOTICE.content,
      text: DEFAULT_LOCAL_NOTICE.content,
      status: '已发布',
      publishAt: formatDateTime(new Date()),
      pollingEnabled: '是',
      source: 'default-local',
      sortTimestamp: Date.now(),
    }
  }

  private filterPendingRows(rows: DashboardPendingRow[], query: DashboardQueryDto) {
    return rows
      .filter((item) => this.matchesModule(item.module, query.module))
      .filter((item) => this.matchesSeverity(item.level, query.severity))
      .sort((left, right) => right.sortTimestamp - left.sortTimestamp)
      .slice(0, 8)
  }

  private matchesModule(moduleLabel: string, moduleKey?: DashboardQueryDto['module']) {
    if (!moduleKey) {
      return true
    }

    return moduleLabel === MODULE_LABELS[moduleKey]
  }

  private matchesSeverity(levelLabel: DashboardPendingRow['level'], severity?: DashboardQueryDto['severity']) {
    if (!severity) {
      return true
    }

    const mapping = {
      high: '高',
      medium: '中',
      low: '低',
    } as const

    return levelLabel === mapping[severity]
  }

  private resolveDateRange(range?: DashboardQueryDto['date']) {
    const now = new Date()
    const start = new Date(now)

    if (range === '30d') {
      start.setDate(now.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return { gte: start }
    }

    if (range === '7d') {
      start.setDate(now.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return { gte: start }
    }

    start.setHours(0, 0, 0, 0)
    return { gte: start }
  }

  private async writeNoticeLogs(
    tx: Prisma.TransactionClient,
    payload: {
      actor: AdminActor
      action: string
      traceId: string
      referenceType: string
      referenceId: string
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.adminOperationLog.create({
      data: {
        adminUserId: payload.actor.adminUserId,
        module: 'dashboard',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: null,
        actorType: 'ADMIN',
        actorId: payload.actor.adminUserId,
        module: 'dashboard',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })

    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(`${payload.referenceType}:${payload.referenceId}:${payload.traceId}:${JSON.stringify(payload.payload)}`),
        syncStatus: 'PENDING',
      },
    })
  }
}
