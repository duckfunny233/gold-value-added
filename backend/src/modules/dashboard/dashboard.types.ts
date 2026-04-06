export type DashboardStat = {
  label: string
  value: string
  note: string
}

export type DashboardPendingRow = {
  id: string
  module: string
  name: string
  owner: string
  level: '高' | '中' | '低'
  time: string
  sortTimestamp: number
}

export type DashboardEvent = {
  traceId: string
  module: string
  detail: string
  time: string
  sortTimestamp: number
}

export type DashboardMonitor = {
  key: string
  label: string
  value: string
}

export type UnifiedNotice = {
  id: string
  title: string
  content: string
  text: string
  status: string
  publishAt: string
  pollingEnabled: '是' | '否'
  source: 'external' | 'local' | 'default-local'
  linkUrl?: string
  imageUrl?: string
  publishedAtIso?: string | null
  sortTimestamp: number
}

export type NoticeFeedMeta = {
  source: 'remote' | 'db-cache' | 'local' | 'default-local' | 'disabled'
  code?: string
  cachedAt?: string | null
}

export type NoticeFeedResult = {
  notices: UnifiedNotice[]
  meta: NoticeFeedMeta
}
