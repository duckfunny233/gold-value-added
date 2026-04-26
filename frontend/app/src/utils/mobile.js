export const maskMobile = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 11) {
    const core = digits.slice(-11)
    return `${core.slice(0, 3)}****${core.slice(7)}`
  }

  if (raw.length <= 4) return raw
  const prefix = raw.slice(0, 2)
  const suffix = raw.slice(-2)
  return `${prefix}${'*'.repeat(Math.max(raw.length - 4, 1))}${suffix}`
}

