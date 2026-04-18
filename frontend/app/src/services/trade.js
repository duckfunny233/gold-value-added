import { apiFetch } from '../utils/request'
import { cloneData, tradeOrdersFallback } from './fallback-data'

const resolveCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    return {}
  }
}

export const TradeService = {
  async getOrders() {
    const user = resolveCurrentUser()
    const query = new URLSearchParams()
    if (user?.uid) query.set('uid', user.uid)
    if (!user?.uid && user?.username) query.set('username', user.username)

    try {
      const path = query.size ? `/api/app/trades?${query.toString()}` : '/api/app/trades'
      return await apiFetch(path)
    } catch (error) {
      return {
        code: 200,
        data: cloneData(tradeOrdersFallback),
      }
    }
  },

  async submitOrder(assetId, type, quantity, assetName, price) {
    const user = resolveCurrentUser()

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
  }
}
