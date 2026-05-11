import { maskMobile } from '../utils/mobile'
import { apiFetch } from '../utils/request'

const STORAGE_KEY = 'jyz_settings_mock_v1'

const defaultState = {
  security: {
    realNameStatus: 'settings.security.status.verified',
    passwordSet: true,
    secretKey: 'Key@2026',
    biometricEnabled: false,
    devices: [],
    loginLogs: [
      { id: 'log_1', time: '2026-04-12 10:26', ip: '116.233.**.**', result: 'success' },
      { id: 'log_2', time: '2026-04-11 21:03', ip: '183.129.**.**', result: 'success' },
      { id: 'log_3', time: '2026-04-10 09:18', ip: '101.69.**.**', result: 'key_error' },
    ],
  },
  account: {
    nickname: '黄金投资者_888',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GoldInvestor',
    mobile: '13812341024',
    bindStatus: 'settings.account.bindStatus.bound',
  },
  general: {
    noticePush: true,
    tradePush: true,
    servicePush: true,
    theme: 'dark',
    refreshSeconds: 5,
  },
  help: {
    faq: [
      { id: 'faq_1', q: 'settings.help.faq.q1', a: 'settings.help.faq.a1' },
      { id: 'faq_2', q: 'settings.help.faq.q2', a: 'settings.help.faq.a2' },
      { id: 'faq_3', q: 'settings.help.faq.q3', a: 'settings.help.faq.a3' },
    ],
  },
  about: {
    version: 'v1.0.0',
    buildTime: '2026-04-12',
    notices: [
      { id: 'n_1', title: 'settings.about.notice.maintenance', time: '2026-04-10 08:00' },
      { id: 'n_2', title: 'settings.about.notice.syncUpgrade', time: '2026-04-08 19:30' },
    ],
    policyEntries: [
      { id: 'userAgreement', titleKey: 'settings.about.userAgreement', url: '/legal/user-agreement.pdf' },
      { id: 'privacyPolicy', titleKey: 'settings.about.privacyPolicy', url: '/legal/privacy-policy.docx' },
      { id: 'riskNotice', titleKey: 'settings.about.riskNotice', url: '/legal/risk-notice.docx' },
      // { id: 'whitepaper', titleKey: 'settings.about.whitepaper', url: '/legal/whitepaper.docx' }, // 暂停：白皮书入口
    ],
  },
}

const wait = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms))

const clone = (value) => JSON.parse(JSON.stringify(value))
const cancelOtpTokens = new Map()

const readState = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return clone(defaultState)
  try {
    const parsed = JSON.parse(raw)
    return { ...clone(defaultState), ...parsed }
  } catch (error) {
    return clone(defaultState)
  }
}

const writeState = (nextState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
}

const normalizeSecurity = (security = {}) => {
  const merged = { ...clone(defaultState).security, ...security }
  // 前端只返回展示所需字段，密钥不回传到页面
  const { secretKey, ...viewData } = merged
  return viewData
}

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch (error) {
    return {}
  }
}

const withUserQuery = (path) => {
  const user = getCurrentUser()
  const uid = String(user?.uid || '').trim()
  const username = String(user?.username || '').trim()
  const query = new URLSearchParams()
  if (uid) query.set('uid', uid)
  if (username) query.set('username', username)
  if (!query.size) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${query.toString()}`
}

export const SettingsService = {
  async getSettingsOverview() {
    let user = {}
    try {
      user = JSON.parse(localStorage.getItem('user') || '{}')
    } catch (error) {
      user = {}
    }
    const username = String(user?.username || '').trim()
    const path = username
      ? `/api/settings/overview?username=${encodeURIComponent(username)}`
      : '/api/settings/overview'
    return apiFetch(path)
  },

  async getSecuritySettings() {
    return apiFetch(withUserQuery('/api/settings/security'))
  },

  async updateSecuritySettings(patch) {
    const user = getCurrentUser()
    return apiFetch('/api/settings/security', {
      method: 'PATCH',
      body: JSON.stringify({
        ...patch,
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },

  async removeDevice(deviceId) {
    return apiFetch(withUserQuery(`/api/settings/security/devices/${encodeURIComponent(deviceId)}`), {
      method: 'DELETE',
    })
  },

  async changeSecretKey(currentKey, newKey) {
    const user = getCurrentUser()
    return apiFetch('/api/settings/security/change-secret-key', {
      method: 'POST',
      body: JSON.stringify({
        currentKey,
        newKey,
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },

  async getAccountSettings() {
    return apiFetch(withUserQuery('/api/settings/account'))
  },

  async updateAccountSettings(patch) {
    const user = getCurrentUser()
    return apiFetch('/api/settings/account', {
      method: 'PUT',
      body: JSON.stringify({
        ...patch,
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },

  async getGeneralSettings() {
    return apiFetch(withUserQuery('/api/settings/general'))
  },

  async updateGeneralSettings(patch) {
    const user = getCurrentUser()
    return apiFetch('/api/settings/general', {
      method: 'PUT',
      body: JSON.stringify({
        ...patch,
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },

  async getHelpSettings() {
    return apiFetch(withUserQuery('/api/settings/help'))
  },

  async submitFeedback(content) {
    const user = getCurrentUser()
    return apiFetch('/api/settings/help/feedback', {
      method: 'POST',
      body: JSON.stringify({
        content,
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },

  async getAboutSettings() {
    return apiFetch(withUserQuery('/api/settings/about'))
  },

  async sendCancelAccountOtp() {
    const user = getCurrentUser()
    return apiFetch('/api/settings/account-cancel/send-otp', {
      method: 'POST',
      body: JSON.stringify({
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },

  async cancelAccount({ secretKey, smsCode, otpToken }) {
    const user = getCurrentUser()
    return apiFetch('/api/settings/account-cancel', {
      method: 'POST',
      body: JSON.stringify({
        secretKey,
        smsCode,
        otpToken,
        uid: user?.uid,
        username: user?.username,
      }),
    })
  },
}
