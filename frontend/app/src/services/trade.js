import { apiFetch } from '../utils/request'
import { cloneData, tradeOrdersFallback } from './fallback-data'

const API_TRADE_ASSET_IDS = new Set(['AU9999', 'AG9999', 'USDX', 'OIL'])
const localTradeOrders = []
let localOrderId = 100000

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
    try {
      const response = await apiFetch('/api/trade/orders')
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
    if (!API_TRADE_ASSET_IDS.has(assetId)) {
      const localOrder = buildLocalOrder(assetName, type, quantity, price)
      localTradeOrders.unshift(localOrder)
      return {
        code: 200,
        message: '下单成功',
        data: localOrder,
      }
    }

    return apiFetch('/api/trade/order', {
      method: 'POST',
      body: JSON.stringify({ assetId, type, quantity })
    })
  }
}
