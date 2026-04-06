import { Injectable } from '@nestjs/common'
import { getJsonRecord, resolveAdminTimeRange, shortenHash, formatDateTime } from '../../common/utils/admin-view.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminAuditQueryDto } from './audit.dto'

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
