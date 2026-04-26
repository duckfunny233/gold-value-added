import { maskMobile } from '../utils/mobile'

const STORAGE_KEY = 'jyz_settings_mock_v1'

const defaultState = {
  security: {
    realNameStatus: 'settings.security.status.verified',
    passwordSet: true,
    secretKey: 'Key@2026',
    biometricEnabled: false,
    devices: [
      { id: 'dev_1', name: 'iPhone 15 Pro', location: '上海', lastActive: '2026-04-12 10:26', trusted: true },
      { id: 'dev_2', name: 'Windows Chrome', location: '杭州', lastActive: '2026-04-11 21:03', trusted: false },
    ],
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
      { id: 'whitepaper', titleKey: 'settings.about.whitepaper', url: '/legal/whitepaper.docx' },
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

export const SettingsService = {
  async getSettingsOverview() {
    await wait()
    return {
      code: 200,
      data: [
        { key: 'security', title: '账户安全', desc: '实名认证、密钥/指纹设置、设备管理、登录日志' },
        { key: 'account', title: '账户管理', desc: '个人信息、手机号换绑、头像/昵称修改' },
        { key: 'general', title: '通用设置', desc: '消息通知、界面主题、行情刷新频率' },
        { key: 'help', title: '帮助服务', desc: '在线客服、常见问题、意见反馈' },
        { key: 'about', title: '关于我们', desc: '版本信息、系统公告、用户协议/隐私政策/白皮书/风险提示' },
        { key: 'cancel-account', title: '注销账号', desc: '风险告知、身份验证、不可恢复注销流程' },
      ],
    }
  },

  async getSecuritySettings() {
    await wait()
    return { code: 200, data: normalizeSecurity(readState().security) }
  },

  async updateSecuritySettings(patch) {
    await wait()
    const state = readState()
    state.security = { ...state.security, ...patch }
    writeState(state)
    return { code: 200, data: normalizeSecurity(state.security) }
  },

  async removeDevice(deviceId) {
    await wait()
    const state = readState()
    state.security.devices = state.security.devices.filter((item) => item.id !== deviceId)
    writeState(state)
    return { code: 200, data: state.security.devices }
  },

  async changeSecretKey(currentKey, newKey) {
    await wait()
    const state = readState()
    const current = String(currentKey || '')
    const next = String(newKey || '')
    const savedKey = state.security?.secretKey || defaultState.security.secretKey

    if (next.length < 6) {
      throw new Error('settings.security.toast.keyTooShort')
    }
    if (current !== savedKey) {
      throw new Error('settings.security.toast.currentKeyWrong')
    }

    state.security = { ...state.security, secretKey: next }
    writeState(state)
    return { code: 200, message: 'settings.security.toast.keyChanged' }
  },

  async getAccountSettings() {
    await wait()
    const account = readState().account || {}
    return { code: 200, data: { ...account, mobile: maskMobile(account.mobile) } }
  },

  async updateAccountSettings(patch) {
    await wait()
    const state = readState()
    state.account = {
      ...state.account,
      ...patch,
      mobile: String(patch?.mobile || state.account?.mobile || '').replace(/\D/g, ''),
    }
    writeState(state)
    return { code: 200, data: { ...state.account, mobile: maskMobile(state.account.mobile) } }
  },

  async getGeneralSettings() {
    await wait()
    const general = { ...readState().general }
    const refreshValue = Number(general.refreshSeconds)
    if (![1, 5, 10].includes(refreshValue)) {
      general.refreshSeconds = 5
      if (refreshValue === 3 && general.servicePush === false) {
        general.servicePush = true
      }
    }
    return { code: 200, data: general }
  },

  async updateGeneralSettings(patch) {
    await wait()
    const state = readState()
    state.general = { ...state.general, ...patch }
    writeState(state)
    return { code: 200, data: state.general }
  },

  async getHelpSettings() {
    await wait()
    return { code: 200, data: readState().help }
  },

  async submitFeedback(content) {
    await wait()
    return {
      code: 200,
      data: {
        feedbackId: `fb_${Date.now()}`,
        content,
        status: '已提交',
      },
    }
  },

  async getAboutSettings() {
    await wait()
    return { code: 200, data: readState().about }
  },

  async sendCancelAccountOtp() {
    await wait()
    const state = readState()
    const otpToken = `cancel_otp_${Date.now()}`
    const otpCode = '654321'
    cancelOtpTokens.set(otpToken, otpCode)
    return {
      code: 200,
      data: {
        otpToken,
        expireSeconds: 60,
        maskedMobile: maskMobile(state.account?.mobile || '13812341024'),
      },
    }
  },

  async cancelAccount({ secretKey, smsCode, otpToken }) {
    await wait()
    const state = readState()
    const expectedKey = state.security?.secretKey || defaultState.security.secretKey

    if (!String(secretKey || '').trim()) {
      throw new Error('settings.cancel.toast.enterKey')
    }
    if (String(secretKey).trim() !== String(expectedKey)) {
      throw new Error('settings.cancel.toast.keyVerifyFailed')
    }

    if (!String(smsCode || '').trim()) {
      throw new Error('settings.cancel.toast.enterSms')
    }
    const expectedOtp = cancelOtpTokens.get(String(otpToken || '')) || '654321'
    if (String(smsCode).trim() !== expectedOtp) {
      throw new Error('settings.cancel.toast.smsWrong')
    }

    state.account = {
      nickname: 'settings.cancel.canceledUser',
      avatar: '',
      mobile: '',
      bindStatus: 'settings.account.bindStatus.unbound',
    }
    state.security = {
      ...state.security,
      devices: [],
      loginLogs: [],
      passwordSet: false,
      biometricEnabled: false,
      secretKey: '',
    }
    writeState(state)
    cancelOtpTokens.delete(String(otpToken || ''))

    return {
      code: 200,
      data: {
        canceledAt: new Date().toISOString(),
        status: 'canceled',
      },
      message: 'settings.cancel.toast.canceled',
    }
  },
}
