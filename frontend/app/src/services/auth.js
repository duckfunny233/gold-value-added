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
      this.clearSensitiveLocalData()
    }
  },

  clearSensitiveLocalData() {
    const removeExactKeys = [
      'token',
      'user',
      'isAuthenticated',
      'jyz_settings_mock_v1',
      'jyz_last_buy_arrival',
      'admin_token',
      'admin_user',
      'admin_roles',
    ]
    removeExactKeys.forEach((key) => localStorage.removeItem(key))

    const prefixedKeys = ['jyz_', 'chat_', 'session_']
    Object.keys(localStorage).forEach((key) => {
      if (prefixedKeys.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    })
  },

  isAuthenticated() {
    return !!localStorage.getItem('token')
  }
}
