import { apiFetch } from '../utils/request'
import { toQueryString } from '../../../shared/utils/query'

const get = (path, params) => apiFetch(`${path}${toQueryString(params)}`)

const send = (path, { method = 'POST', body } = {}) =>
  apiFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

export const ArchiveService = {
  getArchiveConfig() {
    return get('/api/admin/archive/config')
  },
  updateArchiveConfig(payload) {
    return send('/api/admin/archive/config', { method: 'PATCH', body: payload })
  },
  triggerArchive(payload) {
    return send('/api/admin/archive/trigger', { body: payload })
  },
  getArchiveTasks(params) {
    return get('/api/admin/archive/tasks', params)
  },
  getArchiveRecords(params) {
    return get('/api/admin/archive/records', params)
  },
  previewArchiveData(recordId) {
    return get(`/api/admin/archive/records/${recordId}/preview`)
  },
  exportArchiveData(recordId, format = 'csv') {
    return get(`/api/admin/archive/records/${recordId}/export`, { format })
  },
}
