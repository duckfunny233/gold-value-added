import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserStatus, WithdrawalStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import { formatDateTime, getJsonRecord, resolveAdminTimeRange } from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminRiskQueryDto, RiskRulesDto } from './risk.dto'

type RiskRow = {
  uid: string
  nickname: string
  userStatus: string
  riskType: string
  operator: string
  updatedAt: string
  warningLevel: '高' | '中' | '低'
}

type AdminActor = {
  adminUserId: string
  username: string
}

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminRisk(query: AdminRiskQueryDto) {
    const range = resolveAdminTimeRange(query.timeRange)
    const [roles, frozenUsers, withdrawals, failedHashes, logs, systemConfigs] = await Promise.all([
      this.prisma.adminRole.findMany({
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      this.prisma.user.findMany({
        where: {
          status: UserStatus.FROZEN,
          ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' } } : {}),
          ...(range ? { updatedAt: range } : {}),
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.prisma.withdrawalOrder.findMany({
        where: {
          status: {
            in: [WithdrawalStatus.PENDING, WithdrawalStatus.REVIEWING, WithdrawalStatus.APPROVED],
          },
          ...(range ? { submittedAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
        },
        include: {
          user: true,
        },
        orderBy: [{ queueNo: 'asc' }, { submittedAt: 'asc' }],
      }),
      this.prisma.hashRecord.findMany({
        where: {
          syncStatus: {
            not: 'SYNCED',
          },
          ...(range ? { createdAt: range } : {}),
        },
        include: {
          tradeOrder: { include: { user: true } },
          withdrawalOrder: { include: { user: true } },
          rechargeOrder: { include: { user: true } },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.adminOperationLog.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          module: {
            in: ['risk', 'system', 'trade', 'admin-auth'],
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
      this.prisma.systemConfig.findMany({
        where: {
          configKey: {
            in: ['trade_runtime_status', 'trading_status'],
          },
        },
      }),
    ])

    const riskRows = [
      ...frozenUsers.map<RiskRow>((item) => ({
        uid: item.uid,
        nickname: item.nickname || item.username,
        userStatus: '冻结',
        riskType: '冻结用户',
        operator: '风控系统',
        updatedAt: formatDateTime(item.updatedAt),
        warningLevel: '高',
      })),
      ...withdrawals.map<RiskRow>((item) => ({
        uid: item.user.uid,
        nickname: item.user.nickname || item.user.username,
        userStatus: this.mapUserStatus(item.user.status),
        riskType: '提现拦截',
        operator: item.reviewerId || '财务待处理',
        updatedAt: formatDateTime(item.submittedAt),
        warningLevel: item.status === WithdrawalStatus.PENDING ? '高' : '中',
      })),
      ...failedHashes
        .map<RiskRow | null>((item) => {
          const relatedUser =
            item.tradeOrder?.user || item.withdrawalOrder?.user || item.rechargeOrder?.user || null
          if (!relatedUser) {
            return null
          }

          return {
            uid: relatedUser.uid,
            nickname: relatedUser.nickname || relatedUser.username,
            userStatus: this.mapUserStatus(relatedUser.status),
            riskType: '同步异常',
            operator: '系统同步',
            updatedAt: formatDateTime(item.createdAt),
            warningLevel: item.syncStatus === 'PENDING' ? '低' : '中',
          }
        })
        .filter((item): item is RiskRow => Boolean(item)),
    ]
      .filter((item) => this.matchesRiskType(item.riskType, query.riskType))
      .filter((item) => this.matchesWarningLevel(item.warningLevel, query.warningLevel))
      .filter((item) => this.matchesUid(item.uid, query.uid))

    const roleRows = roles
      .map((role) => ({
        role: this.mapRoleName(role.code, role.name),
        permission:
          role.permissions.length > 0
            ? role.permissions.map((item) => item.permission.name).join(' / ')
            : role.description || '暂无权限说明',
        status: '已启用',
      }))
      .filter((item) => this.matchesRole(item.role, query.role))

    const logRows = logs
      .map((item) => ({
        action: this.mapLogAction(item.action),
        operator: item.adminUser?.displayName || item.adminUser?.username || '系统',
        result: this.mapLogResult(item.payload),
        traceId: item.traceId,
        time: formatDateTime(item.createdAt),
        uid: this.extractUid(item.payload),
      }))
      .filter((item) => this.matchesUid(item.uid, query.uid))
      .map(({ uid: _uid, ...item }) => item)

    return {
      roles: roleRows,
      riskRows: riskRows.map(({ warningLevel: _ignored, ...item }) => item),
      warnings: this.buildWarnings(riskRows, logRows.length),
      logs: logRows,
      tradingFlowLabel: this.resolveTradingFlowLabel(systemConfigs),
    }
  }

  getAlerts() {
    return [
      {
        id: 'risk-1',
        level: 'MEDIUM',
        type: 'WITHDRAW_REVIEW',
        message: '存在待处理提现订单，请及时审核。',
      },
    ]
  }

  async getRules() {
    const config = await this.ensureRiskRuleConfig()

    return {
      withdrawInterceptEnabled: config.withdrawInterceptEnabled,
      singleWithdrawalLimit: Number(config.singleWithdrawalLimit),
      dailyWithdrawalLimit: Number(config.dailyWithdrawalLimit),
      abnormalTradeThreshold: Number(config.abnormalTradeThreshold),
      blacklistUids: config.blacklistItems
        .map((item: { uid: string }) => item.uid)
        .sort((left: string, right: string) => left.localeCompare(right)),
      updatedAt: formatDateTime(config.updatedAt),
    }
  }

  async updateRules(body: RiskRulesDto, actor: AdminActor) {
    const traceId = randomUUID()
    const blacklistUids = Array.from(
      new Set(
        body.blacklistUids
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right))

    const updatedConfig = await this.prisma.$transaction(async (tx) => {
      const config = await tx.riskRuleConfig.upsert({
        where: {
          scope: 'default',
        },
        create: {
          scope: 'default',
          withdrawInterceptEnabled: body.withdrawInterceptEnabled,
          singleWithdrawalLimit: new Prisma.Decimal(body.singleWithdrawalLimit),
          dailyWithdrawalLimit: new Prisma.Decimal(body.dailyWithdrawalLimit),
          abnormalTradeThreshold: new Prisma.Decimal(body.abnormalTradeThreshold),
        },
        update: {
          withdrawInterceptEnabled: body.withdrawInterceptEnabled,
          singleWithdrawalLimit: new Prisma.Decimal(body.singleWithdrawalLimit),
          dailyWithdrawalLimit: new Prisma.Decimal(body.dailyWithdrawalLimit),
          abnormalTradeThreshold: new Prisma.Decimal(body.abnormalTradeThreshold),
        },
      })

      await tx.riskBlacklistUid.deleteMany({
        where: {
          riskRuleConfigId: config.id,
        },
      })

      if (blacklistUids.length > 0) {
        await tx.riskBlacklistUid.createMany({
          data: blacklistUids.map((uid) => ({
            riskRuleConfigId: config.id,
            uid,
          })),
        })
      }

      await this.writeAdminOperation(tx, {
        module: 'risk',
        action: 'risk.rule.update',
        traceId,
        actor,
        payload: {
          withdrawInterceptEnabled: body.withdrawInterceptEnabled,
          singleWithdrawalLimit: body.singleWithdrawalLimit,
          dailyWithdrawalLimit: body.dailyWithdrawalLimit,
          abnormalTradeThreshold: body.abnormalTradeThreshold,
          blacklistUids,
          result: '成功',
        },
      })
      await this.writeAuditLog(tx, {
        userId: null,
        action: 'risk.rule.update',
        traceId,
        actor,
        payload: {
          withdrawInterceptEnabled: body.withdrawInterceptEnabled,
          singleWithdrawalLimit: body.singleWithdrawalLimit,
          dailyWithdrawalLimit: body.dailyWithdrawalLimit,
          abnormalTradeThreshold: body.abnormalTradeThreshold,
          blacklistUids,
          result: '成功',
        },
      })
      await this.writeHashRecord(tx, {
        referenceType: 'RISK_RULE_UPDATE',
        referenceId: config.id,
        traceId,
        raw: `risk_rule:${config.id}:${traceId}:${JSON.stringify({
          withdrawInterceptEnabled: body.withdrawInterceptEnabled,
          singleWithdrawalLimit: body.singleWithdrawalLimit,
          dailyWithdrawalLimit: body.dailyWithdrawalLimit,
          abnormalTradeThreshold: body.abnormalTradeThreshold,
          blacklistUids,
        })}`,
      })

      return tx.riskRuleConfig.findUniqueOrThrow({
        where: {
          id: config.id,
        },
        include: {
          blacklistItems: {
            orderBy: {
              uid: 'asc',
            },
          },
        },
      })
    })

    return {
      message: '风控规则已更新',
      data: {
        traceId,
        withdrawInterceptEnabled: updatedConfig.withdrawInterceptEnabled,
        singleWithdrawalLimit: Number(updatedConfig.singleWithdrawalLimit),
        dailyWithdrawalLimit: Number(updatedConfig.dailyWithdrawalLimit),
        abnormalTradeThreshold: Number(updatedConfig.abnormalTradeThreshold),
        blacklistUids: updatedConfig.blacklistItems.map((item: { uid: string }) => item.uid),
      },
    }
  }

  async freezeUser(uid: string, actor: AdminActor) {
    const user = await this.prisma.user.findUnique({
      where: {
        uid,
      },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    if (user.status === UserStatus.FROZEN) {
      throw new ConflictException('当前用户已冻结')
    }

    const traceId = randomUUID()
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          uid,
        },
        data: {
          status: UserStatus.FROZEN,
        },
      })
      await this.writeAdminOperation(tx, {
        module: 'risk',
        action: 'user.freeze',
        traceId,
        actor,
        payload: {
          uid,
          result: '成功',
        },
      })
      await this.writeAuditLog(tx, {
        userId: updatedUser.id,
        action: 'risk.user.freeze',
        traceId,
        actor,
        payload: {
          uid,
          result: '成功',
        },
      })
      await this.writeHashRecord(tx, {
        referenceType: 'USER_FREEZE',
        referenceId: updatedUser.id,
        traceId,
        raw: `user_freeze:${uid}:${actor.adminUserId}:${traceId}`,
      })
      return updatedUser
    })

    return {
      uid: updated.uid,
      status: '冻结',
      traceId,
    }
  }

  async unfreezeUser(uid: string, actor: AdminActor) {
    const user = await this.prisma.user.findUnique({
      where: {
        uid,
      },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException('当前用户未冻结')
    }

    const traceId = randomUUID()
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          uid,
        },
        data: {
          status: UserStatus.ACTIVE,
        },
      })
      await this.writeAdminOperation(tx, {
        module: 'risk',
        action: 'user.unfreeze',
        traceId,
        actor,
        payload: {
          uid,
          result: '成功',
        },
      })
      await this.writeAuditLog(tx, {
        userId: updatedUser.id,
        action: 'risk.user.unfreeze',
        traceId,
        actor,
        payload: {
          uid,
          result: '成功',
        },
      })
      await this.writeHashRecord(tx, {
        referenceType: 'USER_UNFREEZE',
        referenceId: updatedUser.id,
        traceId,
        raw: `user_unfreeze:${uid}:${actor.adminUserId}:${traceId}`,
      })
      return updatedUser
    })

    return {
      uid: updated.uid,
      status: '正常',
      traceId,
    }
  }

  async pauseTrading(actor: AdminActor) {
    return this.updateTradingPauseState(true, actor, 'trade.pause', 'TRADE_PAUSE')
  }

  async resumeTrading(actor: AdminActor) {
    return this.updateTradingPauseState(false, actor, 'trade.resume', 'TRADE_RESUME')
  }

  private mapRoleName(code: string, name: string) {
    const normalized = code.toLowerCase()
    if (normalized.includes('admin')) {
      return '平台管理员'
    }
    if (normalized.includes('risk')) {
      return '风控'
    }
    if (normalized.includes('audit')) {
      return '审计'
    }
    return name
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

  private matchesRole(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (normalized === 'admin') {
      return value === '平台管理员'
    }
    if (normalized === 'risk') {
      return value === '风控'
    }
    if (normalized === 'audit') {
      return value === '审计'
    }
    return value.includes(queryValue)
  }

  private matchesRiskType(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (normalized === 'freeze') {
      return value === '冻结用户'
    }
    if (normalized === 'withdraw') {
      return value === '提现拦截'
    }
    if (normalized === 'warning') {
      return value === '同步异常'
    }
    return value.includes(queryValue)
  }

  private matchesWarningLevel(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (normalized === 'high') {
      return value === '高'
    }
    if (normalized === 'medium') {
      return value === '中'
    }
    if (normalized === 'low') {
      return value === '低'
    }
    return value.includes(queryValue)
  }

  private matchesUid(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    return value.toLowerCase().includes(queryValue.toLowerCase())
  }

  private mapLogAction(action: string) {
    if (action.includes('freeze')) {
      return '冻结用户'
    }
    if (action.includes('unfreeze')) {
      return '解冻用户'
    }
    if (action.includes('role')) {
      return '分配角色'
    }
    if (action.includes('pause')) {
      return '全站停盘'
    }
    if (action.includes('resume')) {
      return '恢复交易'
    }
    return action
  }

  private mapLogResult(payload: unknown) {
    const record = getJsonRecord(payload)
    if (typeof record.result === 'string') {
      return record.result
    }
    if (typeof record.success === 'boolean') {
      return record.success ? '成功' : '失败'
    }
    return '成功'
  }

  private extractUid(payload: unknown) {
    const record = getJsonRecord(payload)
    return typeof record.uid === 'string' ? record.uid : ''
  }

  private buildWarnings(riskRows: RiskRow[], logCount: number) {
    const warnings = [
      '冻结用户必须被交易管理和提现流程同时拦截。',
      '角色权限变更必须即时生效并记录日志。',
      '已停盘状态禁用再次停盘。',
    ]

    if (riskRows.some((item) => item.riskType === '同步异常')) {
      warnings.unshift('当前存在同步异常记录，请优先核查链路回写状态。')
    }
    if (logCount === 0) {
      warnings.push('当前时间范围内暂无风控操作日志，请确认是否已正确筛选。')
    }

    return warnings
  }

  private resolveTradingFlowLabel(configs: Array<{ configKey: string; configValue: unknown }>) {
    const config = configs[0]
    if (!config) {
      return '全站状态 运行中 -> 已停盘 -> 运行中'
    }

    const record = getJsonRecord(config.configValue)
    if (typeof record.label === 'string' && record.label) {
      return record.label
    }
    if (typeof record.status === 'string' && record.status) {
      return `全站状态 ${record.status}`
    }
    return '全站状态 运行中 -> 已停盘 -> 运行中'
  }

  private async ensureRiskRuleConfig() {
    return this.prisma.riskRuleConfig.upsert({
      where: {
        scope: 'default',
      },
      create: {
        scope: 'default',
        withdrawInterceptEnabled: true,
        singleWithdrawalLimit: new Prisma.Decimal(50000),
        dailyWithdrawalLimit: new Prisma.Decimal(100000),
        abnormalTradeThreshold: new Prisma.Decimal(200000),
      },
      update: {},
      include: {
        blacklistItems: {
          orderBy: {
            uid: 'asc',
          },
        },
      },
    })
  }

  private async updateTradingPauseState(
    paused: boolean,
    actor: AdminActor,
    action: string,
    referenceType: string,
  ) {
    const traceId = randomUUID()
    await this.prisma.$transaction(async (tx) => {
      await tx.systemConfig.upsert({
        where: {
          configKey: 'trade_manual_control',
        },
        create: {
          configKey: 'trade_manual_control',
          configValue: {
            paused,
            updatedBy: actor.username,
            updatedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
        update: {
          configValue: {
            paused,
            updatedBy: actor.username,
            updatedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      })

      await this.writeAdminOperation(tx, {
        module: 'trade',
        action,
        traceId,
        actor,
        payload: {
          paused,
          result: '成功',
        },
      })
      await this.writeAuditLog(tx, {
        userId: null,
        action: `risk.${action}`,
        traceId,
        actor,
        payload: {
          paused,
          result: '成功',
        },
      })
      await this.writeHashRecord(tx, {
        referenceType,
        referenceId: 'trade_manual_control',
        traceId,
        raw: `${referenceType}:${paused}:${actor.adminUserId}:${traceId}`,
      })
    })

    return {
      status: paused ? 'PAUSED' : 'OPEN',
      traceId,
    }
  }

  private async writeAdminOperation(
    tx: Prisma.TransactionClient,
    payload: {
      module: string
      action: string
      traceId: string
      actor: AdminActor
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.adminOperationLog.create({
      data: {
        adminUserId: payload.actor.adminUserId,
        module: payload.module,
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    payload: {
      userId: string | null
      action: string
      traceId: string
      actor: AdminActor
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.auditLog.create({
      data: {
        userId: payload.userId,
        actorType: 'ADMIN',
        actorId: payload.actor.adminUserId,
        module: 'risk',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })
  }

  private async writeHashRecord(
    tx: Prisma.TransactionClient,
    payload: {
      referenceType: string
      referenceId: string
      traceId: string
      raw: string
    },
  ) {
    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(payload.raw),
        syncStatus: 'PENDING',
      },
    })
  }
}
