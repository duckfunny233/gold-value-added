import { apiFetch } from '../utils/request'

export const AuthService = {
  login(username, password) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  },
  
  register(userData) {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  },
  
  sendOtp(phone) {
    return apiFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    })
  },

  resetPassword(data) {
    return apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('isAuthenticated')
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem('token')
  }
}
