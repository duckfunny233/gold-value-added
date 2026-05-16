export function resolveClientIp(req: {
  headers?: Record<string, string | string[] | undefined>
  ip?: string
  socket?: { remoteAddress?: string }
}) {
  const forwarded = req.headers?.['x-forwarded-for']
  const forwardedIp = Array.isArray(forwarded)
    ? String(forwarded[0] || '').trim()
    : String(forwarded || '')
        .split(',')[0]
        .trim()

  return (
    forwardedIp ||
    String(req.ip || '').trim() ||
    String(req.socket?.remoteAddress || '').trim() ||
    ''
  )
}
