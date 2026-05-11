import { ref, watch, onMounted, onUnmounted, reactive } from 'vue'
import { MarketService } from '../services/market'
import { SettingsService } from '../services/settings'

const globalSettings = reactive({
  refreshSeconds: 5,
  loaded: false
})

let settingsPromise = null

async function loadSettings() {
  if (globalSettings.loaded) return globalSettings
  if (settingsPromise) return settingsPromise

  settingsPromise = SettingsService.getGeneralSettings()
    .then(response => {
      globalSettings.refreshSeconds = response.data?.refreshSeconds || 5
      globalSettings.loaded = true
      return globalSettings
    })
    .catch(err => {
      console.error('Failed to fetch general settings:', err)
      globalSettings.refreshSeconds = 5
      globalSettings.loaded = true
      return globalSettings
    })
    .finally(() => {
      settingsPromise = null
    })

  return settingsPromise
}

export function useMarketPolling() {
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

  const startPolling = (intervalMs) => {
    if (timer) clearInterval(timer)
    fetchPrices()
    timer = setInterval(fetchPrices, intervalMs)
  }

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(async () => {
    await loadSettings()
    const intervalMs = globalSettings.refreshSeconds * 1000
    startPolling(intervalMs)

    watch(
      () => globalSettings.refreshSeconds,
      (newVal) => {
        if (newVal) {
          startPolling(newVal * 1000)
        }
      }
    )
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    markets,
    loading,
    refresh: fetchPrices
  }
}

export function invalidateSettingsCache() {
  globalSettings.loaded = false
  globalSettings.refreshSeconds = 5
}

export function updateGlobalRefreshSeconds(seconds) {
  globalSettings.refreshSeconds = seconds
}