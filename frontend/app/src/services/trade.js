import { apiFetch } from '../utils/request'
import { cloneData, tradeOrdersFallback } from './fallback-data'

export const TradeService = {
  async getOrders() {
    try {
      const response = await apiFetch('/api/trade/orders')
      return {
        ...response,
        data: Array.isArray(response?.data) ? response.data : [],
      }
    } catch (error) {
      return {
        code: 200,
        data: cloneData(tradeOrdersFallback),
      }
    }
  },

  submitOrder(assetId, type, quantity) {
    return apiFetch('/api/trade/order', {
      method: 'POST',
      body: JSON.stringify({ assetId, type, quantity })
    })
  }
}
