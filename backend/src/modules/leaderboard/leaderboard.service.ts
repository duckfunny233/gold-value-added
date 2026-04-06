import { BadRequestException, Injectable } from '@nestjs/common'
import { LeaderboardJobStatus, LeaderboardRule, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  formatCurrency,
  formatDateTime,
  formatGrams,
  resolveAdminTimeRange,
  toNumber,
} from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { LeaderboardActionDto, LeaderboardQueryDto, LeaderboardRuleDto } from './leaderboard.dto'

type AdminActor = {
  adminUserId: string
  username: string
}

type RebuildMode = 'bootstrap' | 'rebuild' | 'retry-sync'

type LeaderboardJobRecord = {
  id: string
  version: string
  rule: LeaderboardRule
  status: LeaderboardJobStatus
  traceId: string
  totalRows: number
  failedRows: number
  errorMessage: string | null
  startedAt: Date
  finishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: LeaderboardQueryDto) {
    const config = await this.ensureConfig()
    const requestedRule = this.resolveRule(query.sortRule, config.currentRule)
    const jobs = await this.getLatestJobs(requestedRule)
    let latestJob = jobs.latestJob
    let visibleJob = jobs.visibleJob

    if (!visibleJob) {
      const bootstrapped = await this.materializeSnapshot(requestedRule, null, 'bootstrap')
      latestJob = bootstrapped.job
      visibleJob = bootstrapped.job
    }

    const rows = visibleJob
      ? await this.prisma.leaderboardSnapshot.findMany({
          where: {
            jobId: visibleJob.id,
            ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' } } : {}),
            ...(query.syncStatus ? { syncStatus: query.syncStatus } : {}),
            ...(query.timeRange ? { updatedAt: resolveAdminTimeRange(query.timeRange) } : {}),
          },
          orderBy: {
            rank: 'asc',
          },
        })
      : []

    const effectiveLatestJob = latestJob || visibleJob
    const exceptionCount = rows.filter((item) => item.syncStatus === 'exception').length

    return {
      rows: rows.map((item) => ({
        rank: item.rank,
        uid: item.uid,
        nickname: item.nickname,
        goldHoldingGrams: formatGrams(toNumber(item.goldHoldingGrams)),
        totalAsset: formatCurrency(toNumber(item.totalAsset)),
        syncStatus: this.mapSyncStatusLabel(item.syncStatus),
        updatedAt: formatDateTime(item.updatedAt),
      })),
      monitors: [
        {
          key: 'sortRule',
          label: '排序规则',
          value: `当前使用${this.mapRuleLabel(requestedRule)}`,
        },
        {
          key: 'rebuildVersion',
          label: '重建版本',
          value: effectiveLatestJob?.version || '-',
        },
        {
          key: 'lastSyncAt',
          label: '最近同步时间',
          value: effectiveLatestJob?.finishedAt
            ? formatDateTime(effectiveLatestJob.finishedAt)
            : effectiveLatestJob?.updatedAt
              ? formatDateTime(effectiveLatestJob.updatedAt)
              : '-',
        },
        {
          key: 'exceptionReason',
          label: '异常原因',
          value: this.buildExceptionReason(effectiveLatestJob, exceptionCount),
        },
      ],
    }
  }

  async updateRule(body: LeaderboardRuleDto, actor: AdminActor) {
    const config = await this.ensureConfig()
    const nextRule = this.resolveRule(body.sortRule, config.currentRule)
    if (nextRule === config.currentRule) {
      throw new BadRequestException('当前排行榜规则未发生变化')
    }

    const traceId = randomUUID()
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaderboardConfig.upsert({
        where: {
          scope: 'default',
        },
        create: {
          scope: 'default',
          currentRule: nextRule,
          traceId,
        },
        update: {
          currentRule: nextRule,
          traceId,
        },
      })

      await this.writeGovernanceLogs(tx, {
        actor,
        action: 'leaderboard.rule.update',
        traceId,
        referenceType: 'LEADERBOARD_RULE_CHANGE',
        referenceId: result.id,
        payload: {
          previousRule: this.mapRuleValue(config.currentRule),
          currentRule: this.mapRuleValue(nextRule),
          result: '成功',
        } as Prisma.InputJsonValue,
      })

      return result
    })

    return {
      message: '排行榜规则更新成功',
      data: {
        traceId,
        currentRule: this.mapRuleValue(updated.currentRule),
      },
    }
  }

  async rebuild(body: LeaderboardActionDto, actor: AdminActor) {
    const config = await this.ensureConfig()
    const rule = this.resolveRule(body.sortRule, config.currentRule)
    const result = await this.materializeSnapshot(rule, actor, 'rebuild')

    return {
      message: '排行榜重建完成',
      data: {
        traceId: result.traceId,
        version: result.job.version,
        currentRule: this.mapRuleValue(rule),
        status: this.mapJobStatusValue(result.job.status),
        failedRows: result.job.failedRows,
      },
    }
  }

  async retrySync(body: LeaderboardActionDto, actor: AdminActor) {
    const config = await this.ensureConfig()
    const rule = this.resolveRule(body.sortRule, config.currentRule)
    const result = await this.materializeSnapshot(rule, actor, 'retry-sync')

    return {
      message: '排行榜异常重试完成',
      data: {
        traceId: result.traceId,
        version: result.job.version,
        currentRule: this.mapRuleValue(rule),
        status: this.mapJobStatusValue(result.job.status),
        repairedRows: Math.max(0, result.job.totalRows - result.job.failedRows),
      },
    }
  }

  private async materializeSnapshot(rule: LeaderboardRule, actor: AdminActor | null, mode: RebuildMode) {
    const traceId = randomUUID()
    const version = this.generateVersion()

    const job = await this.prisma.leaderboardJob.create({
      data: {
        version,
        rule,
        status: LeaderboardJobStatus.REBUILDING,
        traceId,
      },
    })

    try {
      const [users, unsyncedUids] = await Promise.all([
        this.prisma.user.findMany({
          include: {
            asset: true,
          },
          orderBy: {
            uid: 'asc',
          },
        }),
        this.findUnsyncedUids(),
      ])

      const snapshots = users
        .filter((item) => Boolean(item.asset))
        .map((item) => ({
          uid: item.uid,
          nickname: item.nickname || item.username,
          goldHoldingGrams: item.asset?.goldHoldingGrams ?? new Prisma.Decimal(0),
          totalAsset: item.asset?.totalAsset ?? new Prisma.Decimal(0),
          syncStatus: unsyncedUids.has(item.uid) ? 'exception' : 'synced',
        }))

      snapshots.sort((left, right) => {
        const primary =
          rule === LeaderboardRule.GOLD_HOLDING_GRAMS
            ? toNumber(right.goldHoldingGrams) - toNumber(left.goldHoldingGrams)
            : toNumber(right.totalAsset) - toNumber(left.totalAsset)
        if (primary !== 0) {
          return primary
        }
        return left.uid.localeCompare(right.uid)
      })

      const ranked = snapshots.map((item, index) => ({
        jobId: job.id,
        rank: index + 1,
        uid: item.uid,
        nickname: item.nickname,
        goldHoldingGrams: item.goldHoldingGrams,
        totalAsset: item.totalAsset,
        syncStatus: item.syncStatus,
        updatedAt: new Date(),
      }))

      const failedRows = ranked.filter((item) => item.syncStatus === 'exception').length
      const finalStatus = failedRows > 0 ? LeaderboardJobStatus.FAILED : LeaderboardJobStatus.SYNCED
      const errorMessage = failedRows > 0 ? `${failedRows} 条排行榜快照待修复` : null

      await this.prisma.$transaction(async (tx) => {
        if (ranked.length > 0) {
          await tx.leaderboardSnapshot.createMany({
            data: ranked,
          })
        }

        await tx.leaderboardJob.update({
          where: {
            id: job.id,
          },
          data: {
            status: finalStatus,
            totalRows: ranked.length,
            failedRows,
            errorMessage,
            finishedAt: new Date(),
          },
        })

        if (actor) {
          await this.writeGovernanceLogs(tx, {
            actor,
            action: mode === 'retry-sync' ? 'leaderboard.retry-sync' : 'leaderboard.rebuild',
            traceId,
            referenceType: mode === 'retry-sync' ? 'LEADERBOARD_RETRY_SYNC' : 'LEADERBOARD_REBUILD',
            referenceId: job.id,
            payload: {
              rule: this.mapRuleValue(rule),
              version,
              status: this.mapJobStatusValue(finalStatus),
              failedRows,
              result: finalStatus === LeaderboardJobStatus.FAILED ? '存在异常' : '成功',
            } as Prisma.InputJsonValue,
          })
        }
      })

      return {
        traceId,
        job: {
          ...job,
          status: finalStatus,
          totalRows: ranked.length,
          failedRows,
          errorMessage,
          finishedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.prisma.$transaction(async (tx) => {
        await tx.leaderboardJob.update({
          where: {
            id: job.id,
          },
          data: {
            status: LeaderboardJobStatus.FAILED,
            errorMessage: message,
            finishedAt: new Date(),
          },
        })

        if (actor) {
          await this.writeGovernanceLogs(tx, {
            actor,
            action: mode === 'retry-sync' ? 'leaderboard.retry-sync' : 'leaderboard.rebuild',
            traceId,
            referenceType: mode === 'retry-sync' ? 'LEADERBOARD_RETRY_SYNC' : 'LEADERBOARD_REBUILD',
            referenceId: job.id,
            payload: {
              rule: this.mapRuleValue(rule),
              version,
              status: 'failed',
              errorMessage: message,
              result: '失败',
            } as Prisma.InputJsonValue,
          })
        }
      })
      throw error
    }
  }

  private async ensureConfig() {
    return this.prisma.leaderboardConfig.upsert({
      where: {
        scope: 'default',
      },
      create: {
        scope: 'default',
        currentRule: LeaderboardRule.GOLD_HOLDING_GRAMS,
      },
      update: {},
    })
  }

  private async getLatestJobs(rule: LeaderboardRule) {
    const latestJob = await this.prisma.leaderboardJob.findFirst({
      where: {
        rule,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (latestJob && latestJob.status !== LeaderboardJobStatus.REBUILDING) {
      return {
        latestJob,
        visibleJob: latestJob,
      }
    }

    const visibleJob = await this.prisma.leaderboardJob.findFirst({
      where: {
        rule,
        status: {
          in: [LeaderboardJobStatus.SYNCED, LeaderboardJobStatus.FAILED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      latestJob,
      visibleJob,
    }
  }

  private async findUnsyncedUids() {
    const records = await this.prisma.hashRecord.findMany({
      where: {
        syncStatus: {
          not: 'SYNCED',
        },
      },
      include: {
        tradeOrder: {
          include: {
            user: true,
          },
        },
        rechargeOrder: {
          include: {
            user: true,
          },
        },
        withdrawalOrder: {
          include: {
            user: true,
          },
        },
      },
    })

    return new Set(
      records
        .map((item) => item.tradeOrder?.user.uid || item.rechargeOrder?.user.uid || item.withdrawalOrder?.user.uid || '')
        .filter(Boolean),
    )
  }

  private async writeGovernanceLogs(
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
        module: 'leaderboard',
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
        module: 'leaderboard',
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

  private resolveRule(value: string | undefined, fallback: LeaderboardRule) {
    if (value === 'totalAsset') {
      return LeaderboardRule.TOTAL_ASSET
    }
    if (value === 'goldHoldingGrams') {
      return LeaderboardRule.GOLD_HOLDING_GRAMS
    }
    return fallback
  }

  private mapRuleValue(rule: LeaderboardRule) {
    return rule === LeaderboardRule.TOTAL_ASSET ? 'totalAsset' : 'goldHoldingGrams'
  }

  private mapRuleLabel(rule: LeaderboardRule) {
    return rule === LeaderboardRule.TOTAL_ASSET ? '总资产排序' : '黄金克数排序'
  }

  private mapSyncStatusLabel(status: string) {
    if (status === 'exception') {
      return '异常'
    }
    if (status === 'rebuilding') {
      return '重建中'
    }
    return '已同步'
  }

  private mapJobStatusValue(status: LeaderboardJobStatus) {
    if (status === LeaderboardJobStatus.REBUILDING) {
      return 'rebuilding'
    }
    if (status === LeaderboardJobStatus.FAILED) {
      return 'failed'
    }
    return 'synced'
  }

  private buildExceptionReason(job: LeaderboardJobRecord | null, exceptionCount: number) {
    if (!job) {
      return '尚未生成排行榜快照'
    }
    if (job.status === LeaderboardJobStatus.REBUILDING) {
      return '排行榜快照正在重建中'
    }
    if (exceptionCount > 0 || job.failedRows > 0) {
      return `${Math.max(exceptionCount, job.failedRows)} 条排行榜记录待修复`
    }
    return '未发现异常'
  }

  private generateVersion() {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `lb-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  }
}
