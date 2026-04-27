import { API_BASE } from '../utils/request'

const normalizeBgImage = (value) => {
  if (!value) return value
  return value.startsWith('/images/') ? value.replace('/images/', '/') : value
}

const normalizeProfile = (profile) => {
  const mapPositions = (items = []) => items.map((item) => ({
    ...item,
    bgImage: normalizeBgImage(item.bgImage),
  }))

  return {
    ...profile,
    goldPositions: mapPositions(profile?.goldPositions),
    silverPositions: mapPositions(profile?.silverPositions),
  }
}

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '',
      ...(options.headers || {}),
    },
    body: options.body,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(payload.message || 'request-failed')
  }
  return payload
}

export const UserService = {
  getProfile() {
    return requestJson('/api/user/profile').then((payload) => ({
      ...payload,
      data: normalizeProfile(payload.data || {}),
    }))
  },

  getNotice() {
    return requestJson('/api/notice')
  },

  getActivities() {
    return requestJson('/api/activities')
  },

  getActivityDetail(id) {
    return requestJson(`/api/activities/${id}`)
  },

  getLeaderboard() {
    return requestJson('/api/public/leaderboard')
  },

  getGoldChainRecords() {
    return requestJson('/api/public/gold-chain')
  },

  createRechargeOrder(channel, amount) {
    return requestJson('/api/wallet/recharge', {
      method: 'POST',
      body: JSON.stringify({ channel, amount }),
    })
  },

  confirmRecharge(orderId) {
    return requestJson(`/api/wallet/recharge/${orderId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  sendWithdrawSms(channel, amount, mobile) {
    return requestJson('/api/wallet/withdraw/send-sms', {
      method: 'POST',
      body: JSON.stringify({ channel, amount, mobile }),
    })
  },

  submitWithdraw(channel, amount, smsCode, smsToken, mobile) {
    return requestJson('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ channel, amount, smsCode, smsToken, mobile }),
    })
  },

  // 获取收款方式
  getPaymentMethod() {
    return requestJson('/api/user/payment-method')
  },

  // 绑定收款方式
  bindPaymentMethod(data) {
    return requestJson('/api/user/payment-method', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // 解绑收款方式
  unbindPaymentMethod() {
    return requestJson('/api/user/payment-method', {
      method: 'DELETE',
    })
  },

  // 检查用户是否有充值记录
  hasRechargeHistory() {
    return requestJson('/api/user/recharge-history/check')
  },
}
