import { ref, onMounted, onUnmounted } from 'vue'
import { MarketService } from '../services/market'

export function useMarketPolling(interval = 3000) {
  const markets = ref([])
  const loading = ref(false)
  let timer = null

  const fetchPrices = async () => {
    try {
      const json = await MarketService.getPrices()
      markets.value = json.data
    } catch (err) {
      console.error('Failed to fetch prices:', err)
    }
  }

  onMounted(() => {
    fetchPrices()
    timer = setInterval(fetchPrices, interval)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return {
    markets,
    loading,
    refresh: fetchPrices
  }
}