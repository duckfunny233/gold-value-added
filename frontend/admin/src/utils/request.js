import { createApiFetch, DEFAULT_API_BASE } from '../../../shared/utils/request-core'

export const API_BASE = DEFAULT_API_BASE

export const apiFetch = createApiFetch({
  apiBase: API_BASE,
  unwrapData: true,
  getToken: () => localStorage.getItem('admin_token'),
  onUnauthorized: () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_roles')
    window.location.href = '/login'
  },
})
