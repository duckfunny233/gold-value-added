import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { formatDateTime, getJsonRecord, resolveAdminTimeRange, shortenHash, toNumber } from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminAuditQueryDto, AuditTraceExportQueryDto } from './audit.dto'

type AuditRow = {
  traceId: string
  module: string
  eventType: string
  uid: string
  bizOrderId: string
  hashValue: string
  createdAt: string
  _createdAt: Date
  _payload: unknown
  _syncStatus: string
  _operator: string
}

type AdminActor = {
  adminUserId: string
  username: string
}

type TraceBundle = {
  auditLogs: any[]
  adminLogs: any[]
  hashRecords: any[]
  ledgerEntries: any[]
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminAudit(query: AdminAuditQueryDto) {
    const range = resolveAdminTimeRange(query.timeRange)
    const [auditLogs, adminLogs, hashRecords] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          ...(query.traceId ? { traceId: { contains: query.traceId } } : {}),
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      }),
      this.prisma.adminOperationLog.findMany({
        where: {
          ...(query.traceId ? { traceId: { contains: query.traceId } } : {}),
          ...(range ? { createdAt: range } : {}),
        },
        include: {
          adminUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      }),
      this.prisma.hashRecord.findMany({
        where: {
          ...(query.traceId ? { traceId: { contains: query.traceId } } : {}),
          ...(range ? { createdAt: range } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    const hashByTraceId = new Map<string, (typeof hashRecords)[number]>()
    for (const item of hashRecords) {
      if (!hashByTraceId.has(item.traceId)) {
        hashByTraceId.set(item.traceId, item)
      }
    }

    const rows = [
      ...auditLogs.map<AuditRow>((item) => {
        const hash = hashByTraceId.get(item.traceId)
        const payload = getJsonRecord(item.payload)
        return {
          traceId: item.traceId,
          module: this.mapModuleLabel(item.module),
          eventType: this.mapEventType(item.action),
          uid: item.user?.uid || (typeof payload.uid === 'string' ? payload.uid : '-'),
          bizOrderId: this.resolveBizOrderId(item.traceId, payload, hash?.referenceId),
          hashValue: shortenHash(hash?.sha256),
          createdAt: formatDateTime(item.createdAt),
          _createdAt: item.createdAt,
          _payload: item.payload,
          _syncStatus: hash?.syncStatus || 'PENDING',
          _operator: this.resolveOperator(item.actorType, payload),
        }
      }),
      ...adminLogs.map<AuditRow>((item) => {
        const payload = getJsonRecord(item.payload)
        const hash = hashByTraceId.get(item.traceId)
        return {
          traceId: item.traceId,
          module: this.mapModuleLabel(item.module),
          eventType: this.mapAdminEventType(item.action),
          uid: this.extractUid(payload),
          bizOrderId: this.resolveBizOrderId(item.traceId, payload, hash?.referenceId),
          hashValue: shortenHash(hash?.sha256),
          createdAt: formatDateTime(item.createdAt),
          _createdAt: item.createdAt,
          _payload: item.payload,
          _syncStatus: hash?.syncStatus || 'PENDING',
          _operator: item.adminUser?.displayName || item.adminUser?.username || '管理员',
        }
      }),
    ]
      .filter((item) => this.matchesModule(item.module, query.module))
      .filter((item) => this.matchesEventType(item.eventType, query.eventType))
      .filter((item) => this.matchesUid(item.uid, query.uid))
      .sort((left, right) => right._createdAt.getTime() - left._createdAt.getTime())

    const selected = rows[0]

    return {
      rows: rows.map(({ _createdAt: _ignoredCreatedAt, _payload: _ignoredPayload, _syncStatus: _ignoredSyncStatus, _operator: _ignoredOperator, ...item }) => item),
      detailItems: selected
        ? [
            {
              key: 'beforeData',
              label: '变更前数据',
              value: this.stringifyPayloadField(selected._payload, 'before', '未记录结构化前镜像'),
            },
            {
              key: 'afterData',
              label: '变更后数据',
              value: this.stringifyPayloadField(selected._payload, 'after', this.stringifyPayloadField(selected._payload, 'summary', '已记录业务动作摘要')),
            },
            {
              key: 'operator',
              label: '操作人',
              value: selected._operator,
            },
            {
              key: 'hashAlgorithm',
              label: '哈希算法',
              value: 'SHA-256 (64 位)',
            },
            {
              key: 'chainSyncStatus',
              label: '金链同步状态',
              value: selected._syncStatus === 'SYNCED' ? '已写入半公开金链' : '待同步或需复核',
            },
          ]
        : [],
    }
  }

  async getTraceDetail(traceId: string) {
    const bundle = await this.loadTraceBundle(traceId)
    const nodes = this.buildTraceNodes(bundle)
    const hashItems = bundle.hashRecords.map((item) => ({
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      hash: item.sha256,
      syncStatus: item.syncStatus,
      createdAt: formatDateTime(item.createdAt),
    }))

    return {
      traceId,
      summary: {
        totalNodes: nodes.length,
        auditCount: bundle.auditLogs.length,
        adminOperationCount: bundle.adminLogs.length,
        ledgerCount: bundle.ledgerEntries.length,
        hashCount: bundle.hashRecords.length,
        syncStatus: hashItems.every((item) => item.syncStatus === 'SYNCED') ? 'SYNCED' : 'PENDING',
      },
      nodes,
      hashItems,
    }
  }

  async verifyTraceHash(traceId: string, actor: AdminActor) {
    const bundle = await this.loadTraceBundle(traceId)
    const verificationItems = bundle.hashRecords.map((item) => {
      const expectedHash = this.resolveExpectedHash(item, bundle)
      const passed = expectedHash ? expectedHash === item.sha256 : /^[a-f0-9]{64}$/i.test(item.sha256)
      return {
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        hash: item.sha256,
        passed,
      }
    })

    const failedItems = verificationItems.filter((item) => !item.passed)
    const traceOperationId = randomUUID()
    const result = {
      traceId,
      passed: failedItems.length === 0,
      failedCount: failedItems.length,
      failedItems,
      totalCount: verificationItems.length,
      verifiedAt: formatDateTime(new Date()),
    }

    await this.writeTraceOperation(actor, {
      action: 'audit.trace.verify-hash',
      traceId: traceOperationId,
      referenceType: 'AUDIT_TRACE_VERIFY',
      referenceId: traceId,
      payload: result,
    })

    return {
      message: failedItems.length === 0 ? 'trace 哈希校验通过' : 'trace 哈希校验发现异常',
      data: {
        ...result,
        traceOperationId,
      },
    }
  }

  async exportTrace(traceId: string, query: AuditTraceExportQueryDto, actor: AdminActor) {
    const detail = await this.getTraceDetail(traceId)
    const format = query.format || 'csv'
    if (!['csv', 'json'].includes(format)) {
      throw new BadRequestException('仅支持 csv 或 json 导出')
    }

    const content =
      format === 'json'
        ? JSON.stringify(detail, null, 2)
        : this.toCsv(
            detail.nodes.map((item) => ({
              traceId,
              nodeType: item.nodeType,
              module: item.module,
              action: item.action,
              operator: item.operator,
              referenceType: item.referenceType,
              referenceId: item.referenceId,
              syncStatus: item.syncStatus,
              createdAt: item.createdAt,
            })),
          )

    const exportedAt = new Date()
    const traceOperationId = randomUUID()
    const fileName = `audit-trace-${traceId}.${format}`
    const payload = {
      traceId,
      format,
      fileName,
      contentType: format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      size: Buffer.byteLength(content, 'utf8'),
      exportedAt: formatDateTime(exportedAt),
      totalNodes: detail.summary.totalNodes,
      content,
    }

    await this.writeTraceOperation(actor, {
      action: 'audit.trace.export',
      traceId: traceOperationId,
      referenceType: 'AUDIT_TRACE_EXPORT',
      referenceId: traceId,
      payload,
    })

    return {
      message: 'trace 导出成功',
      data: {
        ...payload,
        traceOperationId,
      },
    }
  }

  getRecords() {
    return [
      {
        traceId: 'trace-demo-1',
        module: 'fund',
        action: 'withdraw.create',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        syncStatus: 'PENDING',
      },
    ]
  }

  private async loadTraceBundle(traceId: string): Promise<TraceBundle> {
    const [auditLogs, adminLogs, hashRecords, ledgerEntries] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { traceId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.adminOperationLog.findMany({
        where: { traceId },
        include: { adminUser: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.hashRecord.findMany({
        where: { traceId },
        include: {
          rechargeOrder: true,
          withdrawalOrder: true,
          tradeOrder: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.ledgerEntry.findMany({
        where: { traceId },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    if (auditLogs.length === 0 && adminLogs.length === 0 && hashRecords.length === 0 && ledgerEntries.length === 0) {
      throw new NotFoundException('trace 不存在')
    }

    return {
      auditLogs,
      adminLogs,
      hashRecords,
      ledgerEntries,
    }
  }

  private buildTraceNodes(bundle: TraceBundle) {
    return [
      ...bundle.auditLogs.map((item) => ({
        nodeType: 'audit',
        module: this.mapModuleLabel(item.module),
        action: item.action,
        operator: this.resolveOperator(item.actorType, getJsonRecord(item.payload)),
        referenceType: this.inferReferenceTypeFromAction(item.action),
        referenceId: this.resolveBizOrderId(item.traceId, getJsonRecord(item.payload)),
        syncStatus: 'n/a',
        createdAt: formatDateTime(item.createdAt),
        _createdAt: item.createdAt,
      })),
      ...bundle.adminLogs.map((item) => ({
        nodeType: 'admin_operation',
        module: this.mapModuleLabel(item.module),
        action: item.action,
        operator: item.adminUser?.displayName || item.adminUser?.username || '管理员',
        referenceType: 'ADMIN_OPERATION',
        referenceId: item.id,
        syncStatus: 'n/a',
        createdAt: formatDateTime(item.createdAt),
        _createdAt: item.createdAt,
      })),
      ...bundle.ledgerEntries.map((item) => ({
        nodeType: 'ledger',
        module: '资金账本',
        action: item.changeType,
        operator: '系统',
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        syncStatus: 'n/a',
        createdAt: formatDateTime(item.createdAt),
        _createdAt: item.createdAt,
      })),
      ...bundle.hashRecords.map((item) => ({
        nodeType: 'hash',
        module: '哈希存证',
        action: item.referenceType,
        operator: '系统',
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        syncStatus: item.syncStatus,
        createdAt: formatDateTime(item.createdAt),
        _createdAt: item.createdAt,
      })),
    ]
      .sort((left, right) => left._createdAt.getTime() - right._createdAt.getTime())
      .map(({ _createdAt: _ignored, ...item }) => item)
  }

  private resolveExpectedHash(hashRecord: any, bundle: TraceBundle) {
    const adminLog = bundle.adminLogs[0]
    const auditLog = bundle.auditLogs[0]
    const adminPayload = adminLog ? getJsonRecord(adminLog.payload) : {}
    const auditPayload = auditLog ? getJsonRecord(auditLog.payload) : {}

    switch (hashRecord.referenceType) {
      case 'RECHARGE_ORDER':
        if (!hashRecord.rechargeOrder?.settledAt) {
          return null
        }
        return sha256(
          `recharge:${hashRecord.referenceId}:${hashRecord.traceId}:${this.stringifyNumber(hashRecord.rechargeOrder.amount)}:completed:${hashRecord.rechargeOrder.settledAt.toISOString()}`,
        )
      case 'WITHDRAWAL_ORDER':
        if (!hashRecord.withdrawalOrder) {
          return null
        }
        return sha256(
          `withdraw:${hashRecord.referenceId}:${hashRecord.traceId}:${this.stringifyNumber(hashRecord.withdrawalOrder.amount)}:freeze`,
        )
      case 'WITHDRAWAL_ORDER_APPROVE':
        return sha256(`withdraw:${hashRecord.referenceId}:${hashRecord.traceId}:approve`)
      case 'WITHDRAWAL_ORDER_REJECT':
        return sha256(`withdraw:${hashRecord.referenceId}:${hashRecord.traceId}:reject`)
      case 'WITHDRAWAL_ORDER_COMPLETE':
        return sha256(`withdraw:${hashRecord.referenceId}:${hashRecord.traceId}:complete`)
      case 'WITHDRAWAL_ORDER_MUTE':
        return sha256(`withdraw:${hashRecord.referenceId}:${hashRecord.traceId}:mute`)
      case 'TRADE_ORDER':
        if (!hashRecord.tradeOrder) {
          return null
        }
        return sha256(
          `trade:${hashRecord.referenceId}:${hashRecord.traceId}:${hashRecord.tradeOrder.side}:${this.stringifyNumber(hashRecord.tradeOrder.price)}:${this.stringifyNumber(hashRecord.tradeOrder.quantityGrams)}`,
        )
      case 'TRADE_MATCH': {
        const [buyOrderId, sellOrderId] = String(hashRecord.referenceId).split(':')
        if (!auditLog) {
          return null
        }
        return sha256(
          `trade_match:${buyOrderId}:${sellOrderId}:${this.stringifyUnknownNumber(auditPayload.matchedPrice)}:${this.stringifyUnknownNumber(auditPayload.matchedGrams)}`,
        )
      }
      case 'MANUAL_TRANSFER':
      case 'MANUAL_ADJUST':
        if (!auditPayload.uid || !auditPayload.direction || !auditPayload.reason) {
          return null
        }
        return sha256(
          `${hashRecord.referenceType}:${hashRecord.referenceId}:${String(auditPayload.uid)}:${String(auditPayload.direction)}:${this.stringifyUnknownNumber(auditPayload.amount)}:${String(auditPayload.reason)}:${hashRecord.traceId}`,
        )
      case 'FUND_IDEMPOTENCY_HIT':
        if (!auditPayload.responsePayload) {
          return null
        }
        return sha256(
          `fund_idempotency_hit:${hashRecord.referenceId}:${hashRecord.traceId}:${JSON.stringify(auditPayload.responsePayload)}`,
        )
      case 'FUND_CONFLICT':
        return sha256(`fund_conflict:${hashRecord.referenceId}:${hashRecord.traceId}`)
      case 'TRADE_IDEMPOTENCY':
        if (!auditLog?.userId) {
          return null
        }
        return sha256(`trade_idempotency:${auditLog.userId}:${hashRecord.traceId}:${JSON.stringify(auditPayload)}`)
      case 'ADMIN_USER_ROLE_ASSIGN':
      case 'ROLE_PERMISSION_ASSIGN':
      case 'LEADERBOARD_RULE_CHANGE':
      case 'LEADERBOARD_REBUILD':
      case 'LEADERBOARD_RETRY_SYNC':
      case 'AUDIT_TRACE_VERIFY':
      case 'AUDIT_TRACE_EXPORT':
      case 'REPORT_JOB_GENERATE':
      case 'REPORT_JOB_EXPORT':
      case 'REPORT_TEMPLATE_CREATE':
        return sha256(`${hashRecord.referenceType}:${hashRecord.referenceId}:${hashRecord.traceId}:${JSON.stringify(adminPayload)}`)
      case 'RISK_RULE_UPDATE':
        return sha256(`risk_rule:${hashRecord.referenceId}:${hashRecord.traceId}:${JSON.stringify({
          withdrawInterceptEnabled: auditPayload.withdrawInterceptEnabled,
          singleWithdrawalLimit: auditPayload.singleWithdrawalLimit,
          dailyWithdrawalLimit: auditPayload.dailyWithdrawalLimit,
          abnormalTradeThreshold: auditPayload.abnormalTradeThreshold,
          blacklistUids: auditPayload.blacklistUids,
        })}`)
      case 'USER_FREEZE':
        if (!adminLog) {
          return null
        }
        return sha256(`user_freeze:${String(adminPayload.uid)}:${adminLog.adminUserId}:${hashRecord.traceId}`)
      case 'USER_UNFREEZE':
        if (!adminLog) {
          return null
        }
        return sha256(`user_unfreeze:${String(adminPayload.uid)}:${adminLog.adminUserId}:${hashRecord.traceId}`)
      case 'TRADE_PAUSE':
      case 'TRADE_RESUME':
        if (!adminLog) {
          return null
        }
        return sha256(`${hashRecord.referenceType}:${String(adminPayload.paused)}:${adminLog.adminUserId}:${hashRecord.traceId}`)
      default:
        return null
    }
  }

  private async writeTraceOperation(
    actor: AdminActor,
    payload: {
      action: string
      traceId: string
      referenceType: string
      referenceId: string
      payload: Record<string, unknown>
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.adminOperationLog.create({
        data: {
          adminUserId: actor.adminUserId,
          module: 'audit',
          action: payload.action,
          traceId: payload.traceId,
          payload: payload.payload as Prisma.InputJsonValue,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: null,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'audit',
          action: payload.action,
          traceId: payload.traceId,
          payload: payload.payload as Prisma.InputJsonValue,
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
    })
  }

  private toCsv(rows: Record<string, unknown>[]) {
    if (rows.length === 0) {
      return 'empty\n'
    }
    const headers = Array.from(new Set(rows.flatMap((item) => Object.keys(item))))
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => this.escapeCsv(row[header]))
          .join(','),
      ),
    ]
    return lines.join('\n')
  }

  private escapeCsv(value: unknown) {
    const normalized =
      value == null
        ? ''
        : typeof value === 'string'
          ? value
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)
    const escaped = normalized.replace(/"/g, '""')
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
  }

  private stringifyNumber(value: Prisma.Decimal | number) {
    return String(toNumber(value))
  }

  private stringifyUnknownNumber(value: unknown) {
    if (typeof value === 'number') {
      return String(value)
    }
    if (typeof value === 'string') {
      return value
    }
    return '0'
  }

  private inferReferenceTypeFromAction(action: string) {
    if (action.startsWith('recharge')) {
      return 'RECHARGE_ORDER'
    }
    if (action.startsWith('withdraw')) {
      return 'WITHDRAWAL_ORDER'
    }
    if (action.startsWith('trade')) {
      return 'TRADE_ORDER'
    }
    return 'AUDIT_LOG'
  }

  private mapModuleLabel(module: string) {
    const mapping: Record<string, string> = {
      fund: '资金管理',
      trade: '交易管理',
      risk: '权限与风控',
      audit: '审计追溯',
      report: '报表中心',
      system: '系统配置',
      'admin-auth': '权限与风控',
    }
    return mapping[module] || module
  }

  private mapEventType(action: string) {
    if (action.startsWith('recharge')) {
      return '充值自动到账'
    }
    if (action.startsWith('withdraw')) {
      return '提现处理'
    }
    if (action.startsWith('trade')) {
      return '买卖撮合'
    }
    return action
  }

  private mapAdminEventType(action: string) {
    if (action.includes('export') || action.includes('report')) {
      return '后台操作'
    }
    if (action.includes('role') || action.includes('freeze') || action.includes('pause')) {
      return '后台操作'
    }
    return this.mapEventType(action)
  }

  private matchesModule(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const mapping: Record<string, string> = {
      funds: '资金管理',
      trades: '交易管理',
      risk: '权限与风控',
    }

    return value === (mapping[queryValue] || queryValue)
  }

  private matchesEventType(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }

    const normalized = queryValue.toLowerCase()
    if (normalized === 'deposit') {
      return value.includes('充值')
    }
    if (normalized === 'withdraw') {
      return value.includes('提现')
    }
    if (normalized === 'trade') {
      return value.includes('买卖') || value.includes('交易')
    }
    if (normalized === 'admin') {
      return value === '后台操作'
    }
    return value.includes(queryValue)
  }

  private matchesUid(value: string, queryValue?: string) {
    if (!queryValue) {
      return true
    }
    return value.toLowerCase().includes(queryValue.toLowerCase())
  }

  private resolveBizOrderId(traceId: string, payload: Record<string, unknown>, referenceId?: string) {
    if (typeof payload.orderId === 'string') {
      return payload.orderId
    }
    if (typeof payload.bizOrderId === 'string') {
      return payload.bizOrderId
    }
    if (referenceId) {
      return referenceId
    }
    return traceId
  }

  private resolveOperator(actorType: string, payload: Record<string, unknown>) {
    if (typeof payload.username === 'string' && payload.username) {
      return payload.username
    }
    return actorType === 'ADMIN' ? '管理员' : '系统'
  }

  private extractUid(payload: Record<string, unknown>) {
    if (typeof payload.uid === 'string' && payload.uid) {
      return payload.uid
    }
    return '-'
  }

  private stringifyPayloadField(payload: unknown, key: string, fallback: string) {
    const record = getJsonRecord(payload)
    const value = record[key]
    if (typeof value === 'string') {
      return value
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value)
    }
    return fallback
  }
}
