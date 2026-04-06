import { apiFetch } from '../utils/request'

export const TradeService = {
  async getOrders() {
    const response = await apiFetch('/api/trade/orders')
    return {
      ...response,
      data: Array.isArray(response?.data) ? response.data : [],
    }
  },

  submitOrder(assetId, type, quantity) {
    return apiFetch('/api/trade/order', {
      method: 'POST',
      body: JSON.stringify({ assetId, type, quantity })
    })
  }
}
