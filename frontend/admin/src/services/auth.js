import { apiFetch } from '../utils/request'

export const AdminAuthService = {
  login(username, password) {
    return apiFetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  getProfile(username) {
    const query = username ? `?username=${encodeURIComponent(username)}` : ''
    return apiFetch(`/api/admin/auth/profile${query}`)
  },

  logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_roles')
  },

  isAuthenticated() {
    return !!localStorage.getItem('admin_token')
  },
}
