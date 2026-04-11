import { NoticeStatus } from '@prisma/client'

export const NEWS_CACHE_TTL_MS = 60_000

export const NEWS_ERROR_CODES = {
  EMPTY_RESPONSE: 'NEWS_EMPTY_RESPONSE',
  FETCH_FAILED: 'NEWS_FETCH_FAILED',
  DB_CACHE_FALLBACK: 'NEWS_DB_CACHE_FALLBACK',
  LOCAL_FALLBACK: 'NEWS_LOCAL_FALLBACK',
} as const

export const DASHBOARD_RULE_REMINDERS = [
  '公告发布后，前端首页应按轮巡方式自动展示。',
  '系统监控必须覆盖同步延迟、排行榜重排、支付对账。',
  '外部财经新闻统一接入天行财经接口展示。',
]

export const MODULE_LABELS = {
  funds: '资金管理',
  trades: '交易管理',
  risk: '权限与风控',
  audit: '审计追溯',
} as const

export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  [NoticeStatus.DRAFT]: '草稿',
  [NoticeStatus.PUBLISHED]: '已发布',
  [NoticeStatus.ARCHIVED]: '已归档',
}

export const DEFAULT_LOCAL_NOTICE = {
  title: '系统公告',
  content: '外部新闻暂时不可用，当前已切换为本地公告兜底展示。',
}
