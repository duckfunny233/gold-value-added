const STORAGE_KEY = 'jyz_settings_mock_v1'

const defaultState = {
  security: {
    realNameStatus: '已实名',
    passwordSet: true,
    biometricEnabled: false,
    devices: [
      { id: 'dev_1', name: 'iPhone 15 Pro', location: '上海', lastActive: '2026-04-12 10:26', trusted: true },
      { id: 'dev_2', name: 'Windows Chrome', location: '杭州', lastActive: '2026-04-11 21:03', trusted: false },
    ],
    loginLogs: [
      { id: 'log_1', time: '2026-04-12 10:26', ip: '116.233.**.**', result: '成功' },
      { id: 'log_2', time: '2026-04-11 21:03', ip: '183.129.**.**', result: '成功' },
      { id: 'log_3', time: '2026-04-10 09:18', ip: '101.69.**.**', result: '密码错误' },
    ],
  },
  account: {
    nickname: '黄金投资者_888',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GoldInvestor',
    mobile: '138****1024',
    bindStatus: '已绑定',
  },
  general: {
    noticePush: true,
    tradePush: true,
    servicePush: false,
    theme: 'dark',
    refreshSeconds: 3,
  },
  help: {
    faq: [
      { id: 'faq_1', q: '充值后多久到账？', a: '正常情况下 1-3 分钟到账，异常时可联系客服处理。' },
      { id: 'faq_2', q: '提现为什么显示到账中？', a: '提现提交后进入渠道处理流程，预计 1-24 小时到账。' },
      { id: 'faq_3', q: '交易时间不在开盘时段怎么办？', a: '系统按上金所时段同步，休市期间无法提交买卖。' },
    ],
  },
  about: {
    version: 'v0.1.0',
    buildTime: '2026-04-12',
    notices: [
      { id: 'n_1', title: '系统维护通知', time: '2026-04-10 08:00' },
      { id: 'n_2', title: '交易时段同步优化上线', time: '2026-04-08 19:30' },
    ],
  },
}

const wait = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms))

const clone = (value) => JSON.parse(JSON.stringify(value))

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

export const SettingsService = {
  async getSettingsOverview() {
    await wait()
    return {
      code: 200,
      data: [
        { key: 'security', title: '账户安全', desc: '实名认证、密码/指纹设置、设备管理、登录日志' },
        { key: 'account', title: '账户管理', desc: '个人信息、手机号换绑、头像/昵称修改' },
        { key: 'general', title: '通用设置', desc: '消息通知、界面主题、行情刷新频率' },
        { key: 'help', title: '帮助服务', desc: '在线客服、常见问题、意见反馈' },
        { key: 'about', title: '关于我们', desc: '版本信息、系统公告、用户协议/隐私政策' },
      ],
    }
  },

  async getSecuritySettings() {
    await wait()
    return { code: 200, data: readState().security }
  },

  async updateSecuritySettings(patch) {
    await wait()
    const state = readState()
    state.security = { ...state.security, ...patch }
    writeState(state)
    return { code: 200, data: state.security }
  },

  async removeDevice(deviceId) {
    await wait()
    const state = readState()
    state.security.devices = state.security.devices.filter((item) => item.id !== deviceId)
    writeState(state)
    return { code: 200, data: state.security.devices }
  },

  async getAccountSettings() {
    await wait()
    return { code: 200, data: readState().account }
  },

  async updateAccountSettings(patch) {
    await wait()
    const state = readState()
    state.account = { ...state.account, ...patch }
    writeState(state)
    return { code: 200, data: state.account }
  },

  async getGeneralSettings() {
    await wait()
    return { code: 200, data: readState().general }
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
}
