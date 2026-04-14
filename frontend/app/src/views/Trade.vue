<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TradeService } from '../services/trade'
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
const BUY_ARRIVAL_STORAGE_KEY = 'jyz_last_buy_arrival'
const buyFeedback = ref({
  visible: false,
  grams: 0,
  animatedGrams: 0,
  image: '/影子金币10g黄金.jpg',
})
let buyFeedbackRaf = null
let buyFeedbackTimer = null

// 如果是通过导航栏直接点进来的（没有 query 参数），则默认选中列表第一个
watch(markets, (newMarkets) => {
  if (newMarkets.length > 0 && !assetId.value) {
    assetId.value = newMarkets[0].id
    assetName.value = newMarkets[0].name
  }
}, { immediate: true })

// 切换品种
const selectAsset = (asset) => {
  assetId.value = asset.id
  assetName.value = asset.name
}

// 获取当前实时单价
const currentPrice = computed(() => {
  const asset = markets.value.find(m => m.id === assetId.value)
  return asset ? parseFloat(asset.price) : null
})

// 计算预计总额
const totalAmount = computed(() => {
  if (!quantity.value || isNaN(quantity.value) || !currentPrice.value) return '0.00'
  return (currentPrice.value * parseFloat(quantity.value)).toFixed(2)
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

const clearBuyFeedback = () => {
  if (buyFeedbackRaf) {
    cancelAnimationFrame(buyFeedbackRaf)
    buyFeedbackRaf = null
  }
  if (buyFeedbackTimer) {
    clearTimeout(buyFeedbackTimer)
    buyFeedbackTimer = null
  }
}

const resolveBuyAssetType = () => {
  const id = String(assetId.value || '').toUpperCase()
  const name = String(assetName.value || '')
  return id.includes('AG') || name.includes('银') ? 'silver' : 'gold'
}

const resolveBuyImage = (grams, type) => {
  if (grams >= 5000) return type === 'gold' ? '/黄金砖5000g黄金.jpg' : '/黄金砖5000g白银.png'
  if (grams >= 1000) return type === 'gold' ? '/黄金条1000g黄金.png' : '/黄金条1000g白银.jpg'
  if (grams >= 500) return type === 'gold' ? '/金影子金币.jpg' : '/金叶币_银.jpg'
  if (grams >= 100) return type === 'gold' ? '/龙币100g黄金.png' : '/龙币100g白银.png'
  if (grams >= 50) return type === 'gold' ? '/金叶币50g黄金.png' : '/金叶币50g白银.png'
  return type === 'gold' ? '/影子金币10g黄金.jpg' : '/影子金币_银.jpg'
}

const runBuyCounter = (target) => {
  const begin = 0
  const duration = 880
  const start = performance.now()
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    buyFeedback.value.animatedGrams = Number((begin + (target - begin) * eased).toFixed(2))
    if (progress < 1) {
      buyFeedbackRaf = requestAnimationFrame(tick)
      return
    }
    buyFeedbackRaf = null
  }
  buyFeedbackRaf = requestAnimationFrame(tick)
}

const triggerBuyFeedback = (grams) => {
  if (!Number.isFinite(grams) || grams <= 0) return
  clearBuyFeedback()

  const type = resolveBuyAssetType()
  buyFeedback.value.visible = true
  buyFeedback.value.grams = Number(grams.toFixed(2))
  buyFeedback.value.animatedGrams = 0
  buyFeedback.value.image = resolveBuyImage(grams, type)

  runBuyCounter(buyFeedback.value.grams)
  buyFeedbackTimer = setTimeout(() => {
    buyFeedback.value.visible = false
  }, 1900)
}

const submitOrder = async () => {
  if (!quantity.value || submitting.value) return

  const submitQuantity = Number(quantity.value)
  submitting.value = true
  try {
    const json = await TradeService.submitOrder(
      assetId.value,
      activeTab.value,
      quantity.value,
      assetName.value || '未命名品种',
      currentPrice.value
    )

    if (activeTab.value === 'buy' && Number.isFinite(submitQuantity) && submitQuantity > 0) {
      triggerBuyFeedback(submitQuantity)
      const arrivalPayload = {
        id: Date.now(),
        assetId: assetId.value,
        assetName: assetName.value || '未命名品种',
        grams: Number(submitQuantity.toFixed(2)),
        createdAt: new Date().toISOString(),
        orderId: json?.data?.id || '',
      }
      localStorage.setItem(BUY_ARRIVAL_STORAGE_KEY, JSON.stringify(arrivalPayload))
      window.dispatchEvent(new CustomEvent('jyz-buy-arrival', { detail: arrivalPayload }))
    }

    showSuccess.value = true
    quantity.value = ''
    fetchOrders() // 刷新列表
    setTimeout(() => { showSuccess.value = false }, 2000)
  } catch (err) {
    console.error('Order failed:', err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchOrders()
})

onBeforeUnmount(() => {
  clearBuyFeedback()
})
</script>

<template>
  <div class="space-y-4 bg-[#0b1520] min-h-full text-white">
    <div class="px-4 pt-4">
      <div class="card-base overflow-hidden relative border-none bg-[#1a2735]">
        <!-- Success Overlay -->
        <div v-if="showSuccess" class="absolute inset-0 bg-white/90 dark:bg-gray-800/90 z-10 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <CheckCircle2 class="text-success mb-2" :size="48" />
          <p class="font-bold text-success">{{ t('trade.orderSuccess') }}</p>
        </div>

        <div v-if="buyFeedback.visible && activeTab === 'buy'" class="buy-feedback-layer">
          <img :src="buyFeedback.image" alt="到账" class="buy-feedback-image" />
          <p class="buy-feedback-text">到账 +{{ buyFeedback.animatedGrams.toFixed(2) }}g</p>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-[#2a3a4b]">
          <button 
            @click="activeTab = 'buy'"
            class="flex-1 py-4 font-bold text-center transition-colors btn-interact"
            :class="activeTab === 'buy' ? 'text-[#ff5f56] border-b-2 border-[#ff5f56] bg-[#2a2430]' : 'text-[#a6b0c3]'"
          >
            {{ t('market.buyAnchor') }}
          </button>
          <button 
            @click="activeTab = 'sell'"
            class="flex-1 py-4 font-bold text-center transition-colors btn-interact"
            :class="activeTab === 'sell' ? 'text-[#19c58a] border-b-2 border-[#19c58a] bg-[#1d2d32]' : 'text-[#a6b0c3]'"
          >
            {{ t('market.sellUnhook') }}
          </button>
        </div>

        <!-- Asset Selector Inside Card -->
        <div class="px-4 pt-3 pb-2 border-b border-[#2a3a4b] bg-[#1f2d3b]">
          <div class="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          <button 
            v-for="asset in markets" 
            :key="asset.id"
            @click="selectAsset(asset)"
            :class="assetId === asset.id ? 'bg-[#c99b18] text-white shadow-sm' : 'bg-[#223244] text-[#a6b0c3] border border-[#304255]'"
            class="px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap btn-interact"
          >
            {{ asset.name }}
          </button>
          </div>
        </div>

        <div class="p-6 space-y-6">
          <div class="space-y-4">
            <div>
              <div class="flex justify-between mb-1">
                <label class="block text-sm font-medium text-white">数量（{{ assetName || '现货黄金' }}）</label>
                <span class="text-[10px] text-[#93a3ba] tabular-nums">{{ t('trade.currentPrice') }} {{ currentPrice || '--.--' }} CNY/g</span>
              </div>
              <input  
                v-model="quantity"
                type="number" 
                :placeholder="t('trade.quantityPlaceholder')"
                class="w-full px-4 py-3 rounded-xl border border-[#314154] bg-[#13202c] text-white placeholder:text-[#7d8da2] focus:ring-2 focus:ring-[#c99b18]/20 focus:border-[#c99b18] outline-none transition-all"
              />
              <div class="mt-2 flex justify-between items-center px-1">
                <span class="text-xs text-[#93a3ba]">{{ t('trade.estimatedAmount') }}</span>
                <span class="text-sm font-bold text-[#c99b18] tabular-nums">¥ {{ totalAmount }}</span>
              </div>
            </div>
          </div>

          <button 
            @click="submitOrder"
            :disabled="!quantity || submitting"
            class="w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 btn-interact"
            :class="activeTab === 'buy' ? 'bg-[#ff5f56] shadow-[#ff5f56]/20' : 'bg-[#19c58a] shadow-[#19c58a]/20'"
          >
            <Loader2 v-if="submitting" class="animate-spin" :size="20" />
            {{ submitting ? t('trade.submitting') : (activeTab === 'buy' ? t('trade.confirmBuy') : t('trade.confirmSell')) }}
          </button>
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="px-4 space-y-3 pb-8">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-white">{{ t('trade.recentOrders') }}</h3>
        <button v-if="!loading" @click="fetchOrders" class="text-xs text-[#c99b18] btn-interact font-medium">{{ t('trade.refresh') }}</button>
      </div>

      <div v-if="loading" class="py-10 flex justify-center">
        <Loader2 class="animate-spin text-gray-300" :size="32" />
      </div>

      <template v-else>
        <div v-for="order in orders" :key="order.id" class="card-base p-4 animate-in slide-in-from-top-2 duration-300">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 text-[10px] rounded font-bold" :class="order.type === '买入' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'">
                {{ order.type }}
              </span>
              <span class="font-bold text-sm">{{ order.name }}</span>
            </div>
            <span class="text-[10px] text-gray-400">{{ order.time }}</span>
          </div>
          <div class="flex justify-between text-xs text-gray-500">
            <span>成交价: <span class="tabular-nums font-medium">{{ order.price }}</span></span>
            <span>数量: <span class="tabular-nums font-medium">{{ order.quantity }}g</span></span>
          </div>
        </div>

        <div v-if="orders.length === 0" class="py-10 text-center text-[#7d8da2] text-sm">
          {{ t('trade.noOrders') }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.buy-feedback-layer {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 9;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding-bottom: 74px;
}

.buy-feedback-image {
  width: 56px;
  height: 56px;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.45));
  animation: buyFlyIn 0.85s cubic-bezier(0.24, 0.88, 0.29, 1);
}

.buy-feedback-text {
  margin-top: 2px;
  color: #f2c24a;
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 0 12px rgba(11, 19, 28, 0.95);
}

@keyframes buyFlyIn {
  0% {
    transform: translateY(62px) scale(0.82);
    opacity: 0;
  }
  58% {
    transform: translateY(-8px) scale(1.07);
    opacity: 1;
  }
  82% {
    transform: translateY(2px) scale(0.98);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>
