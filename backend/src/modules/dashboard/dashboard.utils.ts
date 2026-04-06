import { UnifiedNotice } from './dashboard.types'

const pad = (value: number) => String(value).padStart(2, '0')

export function formatDateTime(value?: Date | null) {
  if (!value) {
    return '-'
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

export function formatTime(value?: Date | null) {
  if (!value) {
    return '-'
  }

  return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

export function trimText(value: string | null | undefined, maxLength = 120) {
  if (!value) {
    return ''
  }

  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}...`
}

export function pickFirstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

export function cloneNotices(notices: UnifiedNotice[]) {
  return notices.map((item) => ({ ...item }))
}
