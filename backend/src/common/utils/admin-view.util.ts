import { Prisma } from '@prisma/client'

export type AdminTimeRange = 'today' | '7d' | '30d'

export function resolveAdminTimeRange(timeRange?: AdminTimeRange) {
  if (!timeRange) {
    return undefined
  }

  const now = new Date()
  const start = new Date(now)

  if (timeRange === '30d') {
    start.setDate(now.getDate() - 30)
  } else if (timeRange === '7d') {
    start.setDate(now.getDate() - 7)
  }

  start.setHours(0, 0, 0, 0)
  return { gte: start }
}

export function formatDateTime(value?: Date | null) {
  if (!value) {
    return '-'
  }

  const pad = (input: number) => String(input).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

export function formatCurrency(value: number) {
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatInteger(value: number) {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  })
}

export function formatGrams(value: number) {
  return `${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}克`
}

export function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) {
    return 0
  }

  return Number(value)
}

export function shortenHash(hash?: string | null) {
  if (!hash) {
    return '-'
  }

  if (hash.length <= 12) {
    return hash
  }

  return `${hash.slice(0, 4)}...${hash.slice(-4)}`
}

export function getJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

export function formatPercent(value: number) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)))
  return `${normalized}%`
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}
