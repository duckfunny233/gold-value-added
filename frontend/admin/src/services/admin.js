import { apiFetch } from '../utils/request'
import { toQueryString } from '../../../shared/utils/query'
import {
  auditData,
  dashboardData,
  fundsData,
  leaderboardData,
  reportsData,
  riskData,
  tradesData,
  usersData,
} from '../../../shared/mocks/admin.js'

const deepClone = (value) => JSON.parse(JSON.stringify(value))
const DEFAULT_SYNC_SESSIONS = [
  { day: '周一至周五', session: '09:00 - 11:30 / 13:30 - 21:00', status: '自动同步中' },
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

const withFallback = async (path, params, fallbackData) => {
  try {
    return await apiFetch(`${path}${toQueryString(params)}`)
  } catch (error) {
    console.warn(`[AdminService] 使用本地模拟数据兜底: ${path}`, error)
    return deepClone(fallbackData)
  }
}

export const AdminService = {
  getDashboard(params) {
    return withFallback('/api/admin/dashboard', params, dashboardData)
  },
  getUsers(params) {
    return withFallback('/api/admin/users', params, usersData)
  },
  getFunds(params) {
    return withFallback('/api/admin/funds', params, fundsData)
  },
  async getTrades(params) {
    const data = await withFallback('/api/admin/trades', params, tradesData)
    return normalizeTradesData(data)
  },
  getLeaderboard(params) {
    return withFallback('/api/admin/leaderboard', params, leaderboardData)
  },
  getRisk(params) {
    return withFallback('/api/admin/risk', params, riskData)
  },
  getAudit(params) {
    return withFallback('/api/admin/audit', params, auditData)
  },
  getReports(params) {
    return withFallback('/api/admin/reports', params, reportsData)
  },
}
