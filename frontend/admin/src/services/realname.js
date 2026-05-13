import { apiFetch } from '../utils/request'
import { toQueryString } from '../../../shared/utils/query'

const get = (path, params) => apiFetch(`${path}${toQueryString(params)}`)

const send = (path, { method = 'POST', body } = {}) =>
  apiFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

export const RealnameService = {
  getRealnameList(params) {
    return get('/api/admin/realname', params)
  },
  getRealnameDetail(id) {
    return get(`/api/admin/realname/${id}`)
  },
  manualCheck(id, payload) {
    return send(`/api/admin/users/${id}/manual-check`, { body: payload })
  },
  getAuditLogs(params) {
    return get('/api/admin/realname/audit-logs', params)
  },
}
