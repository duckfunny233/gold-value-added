import { apiFetch } from '../utils/request'

export const AuthService = {
  login(username, password) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    })
  },

  register(userData) {
    const normalizedPayload = {
      ...userData,
      otpCode: userData?.otpCode || userData?.otp || '',
    }
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload)
    })
  },

  // 支持文件上传的注册接口
  registerWithFiles(formData) {
    return apiFetch('/api/auth/register-with-files', {
      method: 'POST',
      body: formData,
      headers: {
        // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
      }
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
  },

  // 获取实名认证状态
  getRealNameStatus() {
    const user = localStorage.getItem('user')
    if (user) {
      try {
        const userData = JSON.parse(user)
        return userData.realNameVerified || false
      } catch (e) {
        return false
      }
    }
    return false
  },

  // 检查用户是否已完成实名认证
  isRealNameVerified() {
    return this.getRealNameStatus()
  }
}
