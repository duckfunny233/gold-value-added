import { apiFetch } from '../utils/request'
import { toQueryString } from '../../../shared/utils/query'

const get = (path, params) => apiFetch(`${path}${toQueryString(params)}`)

const send = (path, { method = 'POST', body } = {}) =>
  apiFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

export const PlatformService = {
  getPlatformFunds() {
    return get('/api/admin/platform/funds')
  },
  getFundFlowTrend(params) {
    return get('/api/admin/platform/fund-flow-trend', params)
  },
  getUserAssetsSummary() {
    return get('/api/admin/platform/user-assets')
  },
  getFundPoolHealth() {
    return get('/api/admin/platform/fund-pool-health')
  },
  getChannelDistribution() {
    return get('/api/admin/platform/channel-distribution')
  },
  getAbnormalAlerts() {
    return get('/api/admin/platform/abnormal-alerts')
  },
  updateAlertThreshold(payload) {
    return send('/api/admin/platform/alert-threshold', { method: 'PATCH', body: payload })
  },
}
