<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TradeService } from '../services/trade'
import { MarketService } from '../services/market'
import { Loader2, CheckCircle2 } from 'lucide-vue-next'
import { useMarketPolling } from '../composables/useMarketPolling'

defineOptions({ name: 'Trade' })

const { t } = useI18n()
const route = useRoute()
const { markets } = useMarketPolling(3000)

const activeTab = ref(route.query.type || 'buy')
const quantity = ref('')
const orders = ref([])
const loading = ref(false)
const submitting = ref(false)
const showSuccess = ref(false)
const assetName = ref(route.query.assetName || '')
const assetId = ref(route.query.assetId || '')
const tradingStatus = ref({
  isOpen: true,
  statusText: '开盘',
  currentSession: '交易时段同步中',
  nextOpenTime: '--',
  disabledReason: '',
  syncMode: '交易时段同步中',
})
let tradingStatusTimer = null

// 濡傛灉鏄€氳繃瀵艰埅鏍忕洿鎺ョ偣杩涙潵鐨勶紙娌℃湁 query 鍙傛暟锛夛紝鍒欓粯璁ら€変腑鍒楄〃绗竴涓?
watch(markets, (newMarkets) => {
  if (newMarkets.length > 0 && !assetId.value) {
    assetId.value = newMarkets[0].id
    assetName.value = newMarkets[0].name
  }
}, { immediate: true })

// 鍒囨崲鍝佺
const selectAsset = (asset) => {
  assetId.value = asset.id
  assetName.value = asset.name
}

// 鑾峰彇褰撳墠瀹炴椂鍗曚环
const currentPrice = computed(() => {
  const asset = markets.value.find(m => m.id === assetId.value)
  return asset ? parseFloat(asset.price) : null
})

// 璁＄畻棰勮鎬婚
const totalAmount = computed(() => {
  if (!quantity.value || isNaN(quantity.value) || !currentPrice.value) return '0.00'
  return (currentPrice.value * parseFloat(quantity.value)).toFixed(2)
})

const isTradeClosed = computed(() => !tradingStatus.value.isOpen)

const submitDisabledReason = computed(() => {
  if (!isTradeClosed.value) {
    return ''
  }
  return tradingStatus.value.disabledReason || '当前为休市时段，暂不支持提交买卖订单'
})

const fetchOrders = async () => {
  loading.value = true
  try {
    const json = await TradeService.getOrders()
    orders.value = json.data
  } catch (err) {
    console.error('Failed to fetch orders:', err)
  } finally {
    loading.value = false
  }
}

const refreshTradingStatus = async () => {
  try {
    tradingStatus.value = await MarketService.getTradingStatus()
  } catch (err) {
    console.error('Failed to refresh trading status:', err)
    tradingStatus.value = {
      isOpen: true,
      statusText: '状态未知',
      currentSession: '未获取到交易时段，按安全降级显示',
      nextOpenTime: '--',
      disabledReason: '',
      syncMode: '安全降级显示',
    }
  }
}

const submitOrder = async () => {
  if (isTradeClosed.value) return
  if (!quantity.value || submitting.value) return
  
  submitting.value = true
  try {
    const json = await TradeService.submitOrder(assetId.value, activeTab.value, quantity.value)
    showSuccess.value = true
    quantity.value = ''
    fetchOrders() // 鍒锋柊鍒楄〃
    setTimeout(() => { showSuccess.value = false }, 2000)
  } catch (err) {
    console.error('Order failed:', err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  refreshTradingStatus()
  fetchOrders()
  tradingStatusTimer = window.setInterval(refreshTradingStatus, 30000)
})

onUnmounted(() => {
  if (tradingStatusTimer) {
    window.clearInterval(tradingStatusTimer)
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="px-4 pt-4">
      <div class="card-base overflow-hidden relative border-none">
        <!-- Success Overlay -->
        <div v-if="showSuccess" class="absolute inset-0 bg-white/90 dark:bg-gray-800/90 z-10 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <CheckCircle2 class="text-success mb-2" :size="48" />
          <p class="font-bold text-success">{{ t('trade.orderSuccess') }}</p>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-50 dark:border-gray-700">
          <button 
            @click="activeTab = 'buy'"
            class="flex-1 py-4 font-bold text-center transition-colors btn-interact"
            :class="activeTab === 'buy' ? 'text-danger border-b-2 border-danger bg-danger/5' : 'text-gray-400'"
          >
            {{ t('market.buyAnchor') }}
          </button>
          <button 
            @click="activeTab = 'sell'"
            class="flex-1 py-4 font-bold text-center transition-colors btn-interact"
            :class="activeTab === 'sell' ? 'text-success border-b-2 border-success bg-success/5' : 'text-gray-400'"
          >
            {{ t('market.sellUnhook') }}
          </button>
        </div>

        <!-- Asset Selector Inside Card -->
        <div class="px-4 py-3 flex gap-3 overflow-x-auto no-scrollbar border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
          <button 
            v-for="asset in markets" 
            :key="asset.id"
            @click="selectAsset(asset)"
            :class="assetId === asset.id ? 'bg-primary text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'"
            class="px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap btn-interact"
          >
            {{ asset.name }}
          </button>
        </div>

        <div class="p-6 space-y-6">
          <div class="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs text-gray-500">交易状态</p>
                <p class="mt-1 text-base font-bold" :class="tradingStatus.isOpen ? 'text-success' : 'text-danger'">
                  {{ tradingStatus.statusText }}
                </p>
              </div>
              <span class="text-[11px] text-gray-400">{{ tradingStatus.syncMode }}</span>
            </div>
            <div class="mt-3 space-y-1 text-xs text-gray-500">
              <p>当前时段：<span class="font-medium text-gray-700 dark:text-gray-200">{{ tradingStatus.currentSession }}</span></p>
              <p>下一开盘时间：<span class="font-medium text-gray-700 dark:text-gray-200">{{ tradingStatus.nextOpenTime }}</span></p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <div class="flex justify-between mb-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('trade.quantity', { assetName }) }}</label>
                <span class="text-[10px] text-gray-400 tabular-nums">{{ t('trade.currentPrice') }} {{ currentPrice || '--.--' }} CNY/g</span>
              </div>
              <input  
                v-model="quantity"
                type="number" 
                :placeholder="t('trade.quantityPlaceholder')"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <div class="mt-2 flex justify-between items-center px-1">
                <span class="text-xs text-gray-500">{{ t('trade.estimatedAmount') }}</span>
                <span class="text-sm font-bold text-primary tabular-nums">楼 {{ totalAmount }}</span>
              </div>
            </div>
          </div>

          <button 
            @click="submitOrder"
            :disabled="!quantity || submitting || isTradeClosed"
            class="w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 btn-interact"
            :class="activeTab === 'buy' ? 'bg-danger shadow-danger/20' : 'bg-success shadow-success/20'"
          >
            <Loader2 v-if="submitting" class="animate-spin" :size="20" />
            {{ submitting ? t('trade.submitting') : (activeTab === 'buy' ? t('trade.confirmBuy') : t('trade.confirmSell')) }}
          </button>
          <p v-if="submitDisabledReason" class="text-xs text-danger text-center -mt-2">
            {{ submitDisabledReason }}
          </p>
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="px-4 space-y-3 pb-8">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">{{ t('trade.recentOrders') }}</h3>
        <button v-if="!loading" @click="fetchOrders" class="text-xs text-primary btn-interact font-medium">{{ t('trade.refresh') }}</button>
      </div>

      <div v-if="loading" class="py-10 flex justify-center">
        <Loader2 class="animate-spin text-gray-300" :size="32" />
      </div>

      <template v-else>
        <div v-for="order in orders" :key="order.id" class="card-base p-4 animate-in slide-in-from-top-2 duration-300">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 text-[10px] rounded font-bold" :class="order.type === '涔板叆' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'">
                {{ order.type }}
              </span>
              <span class="font-bold text-sm">{{ order.name }}</span>
            </div>
            <span class="text-[10px] text-gray-400">{{ order.time }}</span>
          </div>
          <div class="flex justify-between text-xs text-gray-500">
            <span>鎴愪氦浠? <span class="tabular-nums font-medium">{{ order.price }}</span></span>
            <span>鏁伴噺: <span class="tabular-nums font-medium">{{ order.quantity }}g</span></span>
          </div>
        </div>

        <div v-if="orders.length === 0" class="py-10 text-center text-gray-400 text-sm">
          {{ t('trade.noOrders') }}
        </div>
      </template>
    </div>
  </div>
</template>
