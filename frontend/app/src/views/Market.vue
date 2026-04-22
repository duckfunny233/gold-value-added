<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import KLineChart from '../components/KLineChart.vue'
import { MarketService } from '../services/market'
import { useMarketPolling } from '../composables/useMarketPolling'

defineOptions({ name: 'Market' })

const { t } = useI18n()
const router = useRouter()
const { markets } = useMarketPolling(3000)
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
      type,
    },
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
  const found = periods.value.find((item) => item.value === currentPeriod.value)
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

const changePeriod = (period) => {
  if (currentPeriod.value === period.value) return
  currentPeriod.value = period.value
  fetchKLineData()
}

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
  <div class="space-y-4 bg-[#0b1520] min-h-full text-white pb-10">
    <div class="pt-2">
      <div class="border-y border-[#223242] bg-[#101b28]">
        <div class="flex items-center justify-between border-b border-[#1c2a3b] px-4 py-2 text-[11px] text-[#7f90a4]">
          <span>{{ t('market.productsHint') }}</span>
          <span>{{ markets.length }}</span>
        </div>

        <div class="grid grid-cols-[1.6fr_1fr_0.9fr] items-center gap-2 border-b border-[#223242] bg-[#0f1a2a] px-4 py-2 text-[12px] font-medium text-[#8ea0b5]">
          <span>{{ t('market.table.name') }}</span>
          <span class="text-right">{{ t('market.table.lastPrice') }}</span>
          <span class="text-right">{{ t('market.table.change') }}</span>
        </div>

        <div class="max-h-[310px] overflow-y-auto no-scrollbar">
          <button
            v-for="item in markets"
            :key="item.id"
            @click="selectAsset(item)"
            class="grid w-full grid-cols-[1.6fr_1fr_0.9fr] items-center gap-2 border-b border-[#1a2738] px-4 py-3 text-left transition-colors btn-interact"
            :class="currentAsset?.id === item.id ? 'bg-[#1a2a3d]' : 'bg-transparent'"
          >
            <div class="min-w-0">
              <p
                class="truncate text-[15px] font-bold"
                :class="currentAsset?.id === item.id ? 'text-[#f2c24a]' : 'text-[#e6edf6]'"
              >
                {{ item.name }}
              </p>
              <p class="mt-0.5 text-[11px] text-[#7d8da2]">{{ item.id }}</p>
            </div>

            <p
              class="text-right text-[22px] font-semibold leading-none tabular-nums"
              :class="item.up ? 'text-[#ff5f56]' : 'text-[#19c58a]'"
            >
              {{ item.price || '--.--' }}
            </p>

            <p
              class="text-right text-[18px] font-medium leading-none tabular-nums"
              :class="item.up ? 'text-[#ff5f56]' : 'text-[#19c58a]'"
            >
              {{ item.change || '0.00%' }}
            </p>
          </button>
        </div>
      </div>
    </div>

    <div class="px-4">
      <div class="rounded-3xl border border-[#2b3b4c] bg-[#162331] overflow-hidden flex flex-col h-[300px]">
        <div class="px-4 py-3 flex justify-between items-center border-b border-[#2a3a4b]">
          <h4 class="font-bold text-sm">{{ currentAsset?.name || t('market.selectAsset') }}</h4>
          <div class="flex gap-2 overflow-x-auto no-scrollbar text-[10px] text-[#8e9bb0]">
            <template v-if="periodsLoading">
              <span class="text-[#6f8094]">{{ t('common.loading') }}</span>
            </template>
            <template v-else>
              <button
                v-for="period in periods"
                :key="period.value"
                @click="changePeriod(period)"
                class="pb-0.5 transition-colors btn-interact"
                :class="currentPeriod === period.value ? 'text-[#c99b18] font-bold border-b border-[#c99b18]' : ''"
              >
                {{ t(period.label) }}
              </button>
            </template>
          </div>
        </div>

        <div class="flex-1 relative">
          <div v-if="loading && kLineData.length === 0" class="absolute inset-0 z-10 flex items-center justify-center bg-[#162331]/70">
            <RefreshCw class="animate-spin text-[#c99b18]" :size="24" />
          </div>
          <KLineChart :data="kLineData" :type="currentChartType" />
        </div>
      </div>
    </div>

    <div class="px-4 grid grid-cols-2 gap-4">
      <button
        @click="goToTrade('buy')"
        class="py-3 bg-[#ff5f56] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#ff5f56]/20 btn-interact"
      >
        {{ t('market.buyAnchor') }}
      </button>
      <button
        @click="goToTrade('sell')"
        class="py-3 bg-[#19c58a] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#19c58a]/20 btn-interact"
      >
        {{ t('market.sellUnhook') }}
      </button>
    </div>
  </div>
</template>
