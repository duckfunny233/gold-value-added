import { API_BASE } from '../utils/request'
import {
  activitiesFallback,
  buildActivityDetailFallback,
  cloneData,
  profileFallback,
  leaderboardFallback,
} from './fallback-data'

let fallbackBalanceDelta = 0
const fallbackRechargeOrders = new Map()
const fallbackSmsTokens = new Map()
let fallbackPaymentMethod = null

const normalizeBgImage = (value) => {
  if (!value) return value
  return value.startsWith('/images/') ? value.replace('/images/', '/') : value
}

const parseAmount = (value) => {
  const amount = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

const formatMoney = (value) =>
  Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const applyBalanceDelta = (profile) => {
  if (!profile?.assets?.length) return profile
  const cloned = cloneData(profile)
  const totalAsset = parseAmount(cloned.assets?.[0]?.value || 0)
  const balanceAsset = parseAmount(cloned.assets?.[1]?.value || 0)
  cloned.assets[0].value = formatMoney(totalAsset + fallbackBalanceDelta)
  cloned.assets[1].value = formatMoney(balanceAsset + fallbackBalanceDelta)
  return cloned
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

const requestJsonOrFallback = async (path, options = {}, fallbackData) => {
  try {
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
  } catch (error) {
    return {
      code: 200,
      data: cloneData(typeof fallbackData === 'function' ? fallbackData() : fallbackData),
    }
  }
}

const fetchJsonOrFallback = async (path, fallbackData) => requestJsonOrFallback(path, {}, fallbackData)

export const UserService = {
  getProfile() {
    return fetchJsonOrFallback('/api/user/profile', profileFallback).then((payload) => ({
      ...payload,
      data: applyBalanceDelta(normalizeProfile(payload.data || profileFallback)),
    }))
  },

  getNotice() {
    return fetchJsonOrFallback('/api/notice', { text: '【调试模式】当前正在使用本地兜底数据。' })
  },

  getActivities() {
    return fetchJsonOrFallback('/api/activities', activitiesFallback)
  },

  getActivityDetail(id) {
    return fetchJsonOrFallback(`/api/activities/${id}`, () => buildActivityDetailFallback(id))
  },

  getLeaderboard() {
    return fetchJsonOrFallback('/api/public/leaderboard', { items: leaderboardFallback })
  },

  getGoldChainRecords() {
    return fetchJsonOrFallback('/api/public/gold-chain', [])
  },

  createRechargeOrder(channel, amount) {
    return requestJsonOrFallback(
      '/api/wallet/recharge',
      {
        method: 'POST',
        body: JSON.stringify({ channel, amount }),
      },
      () => {
        const order = {
          orderId: `re_${Date.now()}`,
          channel,
          amount,
          status: 'pending',
          payHint: '请完成支付后点击"我已完成付款"',
        }
        fallbackRechargeOrders.set(order.orderId, order)
        return order
      }
    )
  },

  confirmRecharge(orderId) {
    return requestJsonOrFallback(
      `/api/wallet/recharge/${orderId}/confirm`,
      {
        method: 'POST',
      },
      () => {
        const order = fallbackRechargeOrders.get(orderId)
        if (!order) {
          return {
            orderId,
            status: 'paid',
            amount: 0,
          }
        }
        fallbackBalanceDelta += Number(order.amount || 0)
        return {
          orderId,
          status: 'paid',
          amount: Number(order.amount || 0),
          channel: order.channel,
        }
      }
    )
  },

  sendWithdrawSms(channel, amount, mobile) {
    return requestJsonOrFallback(
      '/api/wallet/withdraw/send-sms',
      {
        method: 'POST',
        body: JSON.stringify({ channel, amount, mobile }),
      },
      () => {
        const smsToken = `sms_${Date.now()}`
        fallbackSmsTokens.set(smsToken, '123456')
        return {
          smsToken,
          maskedMobile: '138****1024',
          expireSeconds: 60,
        }
      }
    )
  },

  submitWithdraw(channel, amount, smsCode, smsToken, mobile) {
    return requestJsonOrFallback(
      '/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({ channel, amount, smsCode, smsToken, mobile }),
      },
      () => {
        const expectedCode = fallbackSmsTokens.get(smsToken) || '123456'
        if (String(smsCode) !== String(expectedCode)) {
          throw new Error('短信验证码错误')
        }
        const availableBalance = parseAmount(profileFallback.assets?.[1]?.value || 0) + fallbackBalanceDelta
        if (Number(amount) > availableBalance) {
          throw new Error('余额不足，无法提现')
        }
        fallbackBalanceDelta -= Number(amount || 0)
        return {
          withdrawId: `wd_${Date.now()}`,
          status: 'processing',
          amount: Number(amount || 0),
          channel,
          message: '提现申请已提交，预计 1-24 小时到账',
        }
      }
    )
  },

  // 获取收款方式
  getPaymentMethod() {
    return requestJsonOrFallback(
      '/api/user/payment-method',
      {},
      () => {
        // 返回本地缓存的收款方式
        return fallbackPaymentMethod
      }
    )
  },

  // 绑定收款方式
  bindPaymentMethod(data) {
    return requestJsonOrFallback(
      '/api/user/payment-method',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      () => {
        // 保存到本地缓存
        fallbackPaymentMethod = {
          ...data,
          id: `pm_${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
        return fallbackPaymentMethod
      }
    )
  },

  // 解绑收款方式
  unbindPaymentMethod() {
    return requestJsonOrFallback(
      '/api/user/payment-method',
      {
        method: 'DELETE',
      },
      () => {
        // 清除本地缓存
        fallbackPaymentMethod = null
        return { success: true }
      }
    )
  },

  // 检查用户是否有充值记录
  hasRechargeHistory() {
    return requestJsonOrFallback(
      '/api/user/recharge-history/check',
      {},
      () => {
        // 根据是否有充值订单判断
        return fallbackBalanceDelta > 0 || fallbackRechargeOrders.size > 0
      }
    )
  },
}
