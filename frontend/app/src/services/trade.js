import { apiFetch } from '../utils/request'
import { cloneData, tradeOrdersFallback } from './fallback-data'

const localTradeOrders = []
let localOrderId = 100000

const resolveCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    return {}
  }
}

const buildLocalOrder = (assetName, type, quantity, price) => ({
  id: localOrderId += 1,
  type: type === 'buy' ? '买入' : '卖出',
  name: assetName || '自定义品种',
  price: Number(price || 0).toFixed(2),
  quantity,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
})

export const TradeService = {
  async getOrders() {
    const user = resolveCurrentUser()
    const query = new URLSearchParams()
    if (user?.uid) query.set('uid', user.uid)
    if (!user?.uid && user?.username) query.set('username', user.username)

    try {
      const path = query.size ? `/api/app/trades?${query.toString()}` : '/api/app/trades'
      const response = await apiFetch(path)
      return {
        ...response,
        data: [...localTradeOrders, ...(Array.isArray(response?.data) ? response.data : [])],
      }
    } catch (error) {
      return {
        code: 200,
        data: [...localTradeOrders, ...cloneData(tradeOrdersFallback)],
      }
    }
  },

  async submitOrder(assetId, type, quantity, assetName, price) {
    const user = resolveCurrentUser()
    const createLocalSuccess = () => {
      const localOrder = buildLocalOrder(assetName, type, quantity, price)
      localTradeOrders.unshift(localOrder)
      return {
        code: 200,
        message: '下单成功',
        data: localOrder,
      }
    }

    try {
      const side = String(type || '').toLowerCase() === 'sell' ? 'sell' : 'buy'
      return await apiFetch(`/api/app/trades/${side}`, {
        method: 'POST',
        body: JSON.stringify({
          uid: user?.uid,
          username: user?.username,
          price: Number(price || 0),
          quantityGrams: Number(quantity || 0),
          assetCode: assetId,
        }),
      })
    } catch (error) {
      // 调试场景：后端不可用时自动降级到本地假接口，保证页面可联调与动画可测试
      return createLocalSuccess()
    }
  }
}
