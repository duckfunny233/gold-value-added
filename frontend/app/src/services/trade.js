import { apiFetch } from '../utils/request'

export const TradeService = {
  getOrders() {
    return apiFetch('/api/trade/orders')
  },

  submitOrder(assetId, type, quantity) {
    return apiFetch('/api/trade/order', {
      method: 'POST',
      body: JSON.stringify({ assetId, type, quantity })
    })
  }
}