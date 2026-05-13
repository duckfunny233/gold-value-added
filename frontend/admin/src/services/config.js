import { apiFetch } from '../utils/request'
import { toQueryString } from '../../../shared/utils/query'

const get = (path, params) => apiFetch(`${path}${toQueryString(params)}`)

const send = (path, { method = 'POST', body } = {}) =>
  apiFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

export const ConfigService = {
  getSystemConfig() {
    return get('/api/admin/config')
  },
  updateSystemConfig(payload) {
    return send('/api/admin/config', { method: 'PATCH', body: payload })
  },
  getConfigLogs(params) {
    return get('/api/admin/config/logs', params)
  },
}
