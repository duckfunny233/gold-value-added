import { apiFetch } from '../utils/request'
import { toQueryString } from '../../../shared/utils/query'

const DEFAULT_SYNC_SESSIONS = [
  { day: '周一至周五', session: '09:00 - 11:30 / 13:30 - 15:30 / 20:00 - 次日02:30', status: '自动同步中' },
]

const pad = (value) => String(value).padStart(2, '0')

const formatDateTime = (date) => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

const createTradeSyncOverview = (sessions, hasRemoteSessions) => {
  const safeSessions = Array.isArray(sessions) && sessions.length ? sessions : DEFAULT_SYNC_SESSIONS
  const activeSession = safeSessions.find((item) => item.status && item.status !== '备用配置') || safeSessions[0]

  return {
    source: '上金所交易时段自动同步',
    syncStatus: hasRemoteSessions ? '同步正常' : '安全降级',
    currentSession: activeSession?.session || '暂无可用交易时段',
    nextOpenTime: activeSession?.status === '生效中' ? '当前时段生效中' : '以下次同步结果为准',
    lastRefreshAt: formatDateTime(new Date()),
    note: hasRemoteSessions
      ? '前端只读展示同步结果，不支持手动修改交易时段。'
      : '未获取到时段字段，已使用安全降级文案展示。',
  }
}

const normalizeTradesData = (value) => {
  const hasRemoteSessions = Array.isArray(value?.sessions) && value.sessions.length > 0
  const sessions = hasRemoteSessions ? value.sessions : DEFAULT_SYNC_SESSIONS

  return {
    ...value,
    stats: Array.isArray(value?.stats) ? value.stats : [],
    trades: Array.isArray(value?.trades) ? value.trades : [],
    controlItems: Array.isArray(value?.controlItems) ? value.controlItems : [],
    monitorCards: Array.isArray(value?.monitorCards) ? value.monitorCards : [],
    sessions,
    syncOverview: createTradeSyncOverview(sessions, hasRemoteSessions),
  }
}

const get = (path, params) => apiFetch(`${path}${toQueryString(params)}`)

const send = (path, { method = 'POST', body, headers } = {}) =>
  apiFetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const buildIdempotencyHeaders = (key) => (key ? { 'Idempotency-Key': key } : undefined)

const serializeNoticeBody = (payload) => ({
  title: payload.title,
  content: payload.content,
  ...(typeof payload.sortOrder === 'number' ? { sortOrder: payload.sortOrder } : {}),
})

const serializeReportFilters = (payload) => ({
  ...(payload.reportType ? { reportType: payload.reportType } : {}),
  ...(payload.timeRange ? { timeRange: payload.timeRange } : {}),
  ...(payload.uid ? { uid: payload.uid } : {}),
  ...(payload.channel ? { channel: payload.channel } : {}),
  ...(payload.format ? { format: payload.format } : {}),
  ...(payload.templateId ? { templateId: payload.templateId } : {}),
  ...(payload.name ? { name: payload.name } : {}),
  ...(payload.defaultFormat ? { defaultFormat: payload.defaultFormat } : {}),
})

const serializeRiskRules = (payload) => ({
  withdrawInterceptEnabled: Boolean(payload.withdrawInterceptEnabled),
  singleWithdrawalLimit: Number(payload.singleWithdrawalLimit || 0),
  dailyWithdrawalLimit: Number(payload.dailyWithdrawalLimit || 0),
  abnormalTradeThreshold: Number(payload.abnormalTradeThreshold || 0),
  blacklistUids: Array.isArray(payload.blacklistUids) ? payload.blacklistUids : [],
})

const normalizeReportJobRows = (rows = []) =>
  rows.map((item) => ({
    jobId: item.jobId,
    name: item.templateName || `${item.reportType} 报表任务`,
    generatedAt: item.finishedAt || item.createdAt,
    generatedBy: item.generatedBy || '系统',
    aggregationRule: item.aggregationRule || '按筛选条件汇总',
    dataSourceModules: item.dataSourceModules || item.reportType,
    status:
      item.status === 'SUCCEEDED'
        ? '已完成'
        : item.status === 'RUNNING'
          ? '生成中'
          : item.status === 'FAILED'
            ? '失败'
            : '待生成',
    traceId: item.traceId,
    requestedFormat: item.requestedFormat,
    rowCount: item.rowCount,
  }))

const normalizeTemplates = (rows = []) =>
  rows.map((item) => ({
    templateId: item.templateId,
    name: item.name,
    reportType: item.reportType,
    filters: item.filters,
    defaultFormat: item.defaultFormat,
    traceId: item.traceId,
    createdAt: item.createdAt,
  }))

const normalizeAuditTraceDetail = (detail) => {
  if (!detail) {
    return []
  }

  return [
    { key: 'summary', label: '链路摘要', value: `节点 ${detail.summary?.totalNodes || 0} 个 / 哈希 ${detail.summary?.hashCount || 0} 个` },
    { key: 'syncStatus', label: '同步状态', value: detail.summary?.syncStatus || '-' },
    ...(detail.nodes || []).slice(0, 8).map((item, index) => ({
      key: `node_${index}`,
      label: `${item.nodeType} / ${item.module}`,
      value: `${item.action} / ${item.referenceType}:${item.referenceId} / ${item.createdAt}`,
    })),
  ]
}

export const AdminService = {
  getDashboard(params) {
    return get('/api/admin/dashboard', params)
  },
  getUsers(params) {
    return get('/api/admin/users', params)
  },
  getFunds(params) {
    return get('/api/admin/funds', params)
  },
  async getTrades(params) {
    const data = await get('/api/admin/trades', params)
    return normalizeTradesData(data)
  },
  getLeaderboard(params) {
    return get('/api/admin/leaderboard', params)
  },
  getRisk(params) {
    return get('/api/admin/risk', params)
  },
  getAudit(params) {
    return get('/api/admin/audit', params)
  },
  getReports(params) {
    return get('/api/admin/reports', params)
  },
  getAdminSecurityUsers() {
    return get('/api/admin/security/admin-users')
  },
  getAdminSecurityRoles() {
    return get('/api/admin/security/roles')
  },
  createAdminUser(payload) {
    return send('/api/admin/security/admin-users', { body: payload })
  },
  assignAdminUserRoles(adminUserId, roleIds) {
    return send(`/api/admin/security/admin-users/${adminUserId}/roles`, {
      body: { roleIds },
    })
  },

  publishNotice(payload) {
    return send('/api/admin/dashboard/notices', { body: serializeNoticeBody(payload) })
  },
  updateNotice(noticeId, payload) {
    return send(`/api/admin/dashboard/notices/${noticeId}`, {
      method: 'PATCH',
      body: serializeNoticeBody(payload),
    })
  },
  deleteNotice(noticeId) {
    return send(`/api/admin/dashboard/notices/${noticeId}`, { method: 'DELETE' })
  },

  pauseTrading() {
    return send('/api/admin/trades/pause')
  },
  resumeTrading() {
    return send('/api/admin/trades/resume')
  },
  retryTradeSync(payload = {}) {
    return send('/api/admin/trades/retry-sync', { body: payload })
  },

  approveWithdrawal(orderId) {
    return send(`/api/admin/funds/withdrawals/${orderId}/approve`)
  },
  rejectWithdrawal(orderId) {
    return send(`/api/admin/funds/withdrawals/${orderId}/reject`)
  },
  confirmWithdrawalCompleted(orderId) {
    return send(`/api/admin/funds/withdrawals/${orderId}/confirm-completed`)
  },
  muteWithdrawalAlert(orderId) {
    return send(`/api/admin/funds/withdrawals/${orderId}/mute-alert`)
  },
  manualTransfer(payload, idempotencyKey) {
    return send('/api/admin/funds/manual-transfer', {
      body: payload,
      headers: buildIdempotencyHeaders(idempotencyKey),
    })
  },
  manualAdjust(payload, idempotencyKey) {
    return send('/api/admin/funds/manual-adjust', {
      body: payload,
      headers: buildIdempotencyHeaders(idempotencyKey),
    })
  },

  freezeUser(uid) {
    return send(`/api/admin/users/${uid}/freeze`)
  },
  unfreezeUser(uid) {
    return send(`/api/admin/users/${uid}/unfreeze`)
  },
  manualCheckUser(uid, payload = {}) {
    return send(`/api/admin/users/${uid}/manual-check`, { body: payload })
  },

  getRiskRules() {
    return get('/api/admin/risk/rules')
  },
  updateRiskRules(payload) {
    return send('/api/admin/risk/rules', { body: serializeRiskRules(payload) })
  },

  updateLeaderboardRule(sortRule) {
    return send('/api/admin/leaderboard/rule', { body: { sortRule } })
  },
  rebuildLeaderboard(payload) {
    return send('/api/admin/leaderboard/rebuild', { body: payload })
  },
  retryLeaderboardSync(payload) {
    return send('/api/admin/leaderboard/retry-sync', { body: payload })
  },

  getAuditTrace(traceId) {
    return get(`/api/admin/audit/trace/${encodeURIComponent(traceId)}`)
  },
  verifyAuditTraceHash(traceId) {
    return send(`/api/admin/audit/trace/${encodeURIComponent(traceId)}/verify-hash`)
  },
  exportAuditTrace(traceId, format = 'csv') {
    return get(`/api/admin/audit/trace/${encodeURIComponent(traceId)}/export`, { format })
  },
  mapAuditTraceToDetailItems(detail) {
    return normalizeAuditTraceDetail(detail)
  },

  generateReport(payload) {
    return send('/api/admin/reports/generate', { body: serializeReportFilters(payload) })
  },
  getReportJobs(params) {
    return get('/api/admin/reports/jobs', params)
  },
  getReportJob(jobId) {
    return get(`/api/admin/reports/jobs/${jobId}`)
  },
  exportReportJob(jobId, payload = { format: 'csv' }) {
    return send(`/api/admin/reports/jobs/${jobId}/export`, { body: payload })
  },
  createReportTemplate(payload) {
    return send('/api/admin/reports/templates', { body: serializeReportFilters(payload) })
  },
  getReportTemplates(params) {
    return get('/api/admin/reports/templates', params)
  },
  normalizeReportJobRows,
  normalizeTemplates,
}
