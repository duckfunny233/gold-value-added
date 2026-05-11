import { sha256 } from './hash.util'

/** Stable short fingerprint for indexing (hashed User-Agent). */
export function clientFingerprintFromUserAgent(userAgent: string | undefined): string {
  const raw = String(userAgent || 'unknown').trim().toLowerCase()
  return sha256(raw)
}

/** Best-effort label for device management UI (no external geo/IP dependency). */
export function summarizeClient(userAgent: string | undefined): { deviceName: string } {
  const ua = String(userAgent || '').trim() || 'Unknown'

  let os = 'Unknown'
  if (/Windows NT 10|Windows 11|Win64/i.test(ua)) {
    os = 'Windows'
  } else if (/Windows/i.test(ua)) {
    os = 'Windows'
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = 'macOS'
  } else if (/Android/i.test(ua)) {
    os = 'Android'
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = /iPad/i.test(ua) ? 'iPad' : 'iPhone'
  } else if (/Linux/i.test(ua)) {
    os = 'Linux'
  }

  let browser = 'Browser'
  if (/Edg\//i.test(ua)) {
    browser = 'Edge'
  } else if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Chrome'
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'Firefox'
  } else if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua)) {
    browser = 'Safari'
  } else if (/MicroMessenger/i.test(ua)) {
    browser = 'WeChat'
  }

  return { deviceName: `${os} ${browser}` }
}
