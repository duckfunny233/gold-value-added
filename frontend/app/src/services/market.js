import { apiFetch } from '../utils/request'

export const MarketService = {
  getPrices() {
    return apiFetch('/api/market/prices')
  },

  getPeriods() {
    return apiFetch('/api/market/periods')
  },

  getKLine(assetId, period) {
    return apiFetch(`/api/market/kline?period=${period}&asset=${assetId}`)
  }
}