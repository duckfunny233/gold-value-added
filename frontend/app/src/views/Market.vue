<script setup>
import { computed } from 'vue'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-vue-next'
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import KLineChart from '../components/KLineChart.vue'
import { MarketService } from '../services/market'
import { useMarketPolling } from '../composables/useMarketPolling'

defineOptions({ name: 'Market' })

const { t } = useI18n()
const router = useRouter()
const { markets, refresh: fetchPrices } = useMarketPolling(3000)
const kLineData = ref([])
const loading = ref(false)
const currentPeriod = ref('1m')
const currentAsset = ref(null)
const periods = ref([])
const periodsLoading = ref(true)

const goToTrade = (type) => {
  if (!currentAsset.value) return
  router.push({ 
    name: 'Trade', 
    query: { 
      assetId: currentAsset.value.id,
      assetName: currentAsset.value.name,
      type: type 
    } 
  })
}

const fetchPeriods = async () => {
  periodsLoading.value = true
  try {
    const res = await MarketService.getPeriods()
    periods.value = res.data
    if (res.data.length > 0 && !currentPeriod.value) {
      currentPeriod.value = res.data[0].value
    }
  } catch (err) {
    console.error('Failed to fetch periods:', err)
  } finally {
    periodsLoading.value = false
  }
}

const currentChartType = computed(() => {
  const found = periods.value.find(p => p.value === currentPeriod.value)
  return found ? found.type : 'candle'
})

const fetchKLineData = async () => {
  if (!currentAsset.value) return
  loading.value = true
  try {
    const json = await MarketService.getKLine(currentAsset.value.id, currentPeriod.value)
    kLineData.value = json.data
  } catch (err) {
    console.error('Failed to fetch kline data:', err)
  } finally {
    loading.value = false
  }
}

const selectAsset = (asset) => {
  if (currentAsset.value?.id === asset.id) return
  currentAsset.value = asset
  fetchKLineData()
}

const changePeriod = (p) => {
  if (currentPeriod.value === p.value) return
  currentPeriod.value = p.value
  fetchKLineData()
}

// 动态默认选中
watch(markets, (newMarkets) => {
  if (newMarkets.length > 0 && !currentAsset.value) {
    currentAsset.value = newMarkets[0]
    fetchKLineData()
  }
}, { immediate: true })

onMounted(() => {
  fetchPeriods()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Market List -->
    <div class="bg-white dark:bg-gray-800 shadow-sm min-h-[280px]">
      <div 
        v-for="item in markets" 
        :key="item.id" 
        @click="selectAsset(item)"
        :class="currentAsset?.id === item.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'"
        class="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700 transition-all cursor-pointer"
      >
        <div>
          <h4 class="font-bold" :class="currentAsset?.id === item.id ? 'text-primary' : ''">{{ item.name }}</h4>
          <span class="text-[10px] text-gray-400">{{ t('market.realTime') }}</span>
        </div>
        <div class="text-right">
          <div class="font-bold text-lg tabular-nums" :class="item.up ? 'text-red-500' : 'text-green-500'">{{ item.price || '--.--' }}</div>
          <div class="text-xs flex items-center justify-end gap-1" :class="item.up ? 'text-red-500' : 'text-green-500'">
            <component :is="item.up ? TrendingUp : TrendingDown" :size="12" />
            {{ item.change || '0.00%' }}
          </div>
        </div>
      </div>
      
      <!-- Loading placeholders -->
      <div v-if="markets.length === 0" class="p-8 text-center text-gray-400 text-sm">
        {{ t('market.connecting') }}
      </div>
    </div>

    <!-- Chart Section -->
    <div class="px-4">
      <div class="card-base overflow-hidden flex flex-col h-[300px]">
        <div class="px-4 py-3 flex justify-between items-center border-b border-gray-50 dark:border-gray-700">
          <h4 class="font-bold text-sm">{{ currentAsset?.name || t('market.selectAsset') }}</h4>
          <div class="flex gap-4 text-[10px] text-gray-400">
            <template v-if="periodsLoading">
              <span class="text-gray-300">{{ t('common.loading') }}</span>
            </template>
            <template v-else>
              <button 
                v-for="p in periods" 
                :key="p.value"
                @click="changePeriod(p)"
                :class="currentPeriod === p.value ? 'text-primary font-bold border-b border-primary' : ''"
                class="pb-0.5 transition-colors btn-interact"
              >
                {{ t(p.label) }}
              </button>
            </template>
          </div>
        </div>
        
        <div class="flex-1 relative">
          <div v-if="loading && kLineData.length === 0" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-800/50 z-10">
            <RefreshCw class="animate-spin text-primary" :size="24" />
          </div>
          <KLineChart 
            :data="kLineData" 
            :type="currentChartType"
          />
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="px-4 grid grid-cols-2 gap-4 pb-10">
      <button 
        @click="goToTrade('buy')"
        class="py-3 bg-danger text-white text-sm font-bold rounded-xl shadow-lg shadow-danger/20 btn-interact"
      >
        {{ t('market.buyAnchor') }}
      </button>
      <button 
        @click="goToTrade('sell')"
        class="py-3 bg-success text-white text-sm font-bold rounded-xl shadow-lg shadow-success/20 btn-interact"
      >
        {{ t('market.sellUnhook') }}
      </button>
    </div>
  </div>
</template>
