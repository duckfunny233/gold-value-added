import { apiFetch } from '../utils/request'

export const AdminService = {
  getDashboard(params) {
    return apiFetch(`/api/admin/dashboard${toQueryString(params)}`)
  },
  getUsers(params) {
    return apiFetch(`/api/admin/users${toQueryString(params)}`)
  },
  getFunds(params) {
    return apiFetch(`/api/admin/funds${toQueryString(params)}`)
  },
  getTrades(params) {
    return apiFetch(`/api/admin/trades${toQueryString(params)}`)
  },
  getLeaderboard(params) {
    return apiFetch(`/api/admin/leaderboard${toQueryString(params)}`)
  },
  getRisk(params) {
    return apiFetch(`/api/admin/risk${toQueryString(params)}`)
  },
  getAudit(params) {
    return apiFetch(`/api/admin/audit${toQueryString(params)}`)
  },
  getReports(params) {
    return apiFetch(`/api/admin/reports${toQueryString(params)}`)
  },
}

function toQueryString(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) {
      search.set(key, value)
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}
