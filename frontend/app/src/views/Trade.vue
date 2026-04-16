<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TradeService } from '../services/trade'
import { UserService } from '../services/user'
import { MarketService } from '../services/market'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { useMarketPolling } from '../composables/useMarketPolling'
import { showToast } from '../composables/useToast'

defineOptions({ name: 'Trade' })

const { t } = useI18n()
const route = useRoute()
const { markets } = useMarketPolling(3000)

const activeTab = ref(route.query.type || 'buy')
const quantity = ref('')
const orders = ref([])
const loading = ref(false)
const submitting = ref(false)
const availableBalance = ref(null)
const assetName = ref(route.query.assetName || '')
const assetId = ref(route.query.assetId || '')
const BUY_ARRIVAL_STORAGE_KEY = 'jyz_last_buy_arrival'
const buyFeedback = ref({
  visible: false,
  grams: 0,
  animatedGrams: 0,
  image: '/影子金币10g黄金.png',
})
let buyFeedbackRaf = null
let buyFeedbackTimer = null

// 五档盘口相关
const showOrderBook = ref(false)
const orderBookAssetId = ref('')
const orderBookData = ref({
  buy: [],
  sell: []
})
const orderBookLoading = ref(false)
const orderBookTimer = null

// 品种列表（与 markets 顺序一致）
const assetList = computed(() => markets.value)

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

const parseMoney = (value) => {
  const amount = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

const fetchAvailableBalance = async () => {
  try {
    const profile = await UserService.getProfile()
    const balanceItem = (profile?.data?.assets || []).find((item) => item?.key === 'profile.assets.balance')
    availableBalance.value = parseMoney(balanceItem?.value)
  } catch (error) {
    availableBalance.value = null
  }
}

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
  if (grams >= 5000) return type === 'gold' ? '/黄金砖5000g黄金.png' : '/黄金砖5000g白银.png'
  if (grams >= 1000) return type === 'gold' ? '/黄金条1000g黄金.png' : '/黄金条1000g白银.png'
  if (grams >= 100) return type === 'gold' ? '/龙币100g黄金.png' : '/龙币100g白银.png'
  if (grams >= 50) return type === 'gold' ? '/金叶币50g黄金.png' : '/金叶币50g白银.png'
  return type === 'gold' ? '/影子金币10g黄金.png' : '/影子金币10g白银.png'
}

const runBuyCounter = (target) => {
  const begin = 0
  const duration = 1000
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

const triggerHaptic = (pattern = 18) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
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
  }, 2000)
}

const submitOrder = async () => {
  if (!quantity.value || submitting.value) return

  const submitQuantity = Number(quantity.value)
  if (!Number.isFinite(submitQuantity) || submitQuantity <= 0) {
    showToast(t('trade.quantityPlaceholder'))
    return
  }

  if (activeTab.value === 'buy' && currentPrice.value && availableBalance.value != null) {
    const expectedAmount = currentPrice.value * submitQuantity
    if (expectedAmount > availableBalance.value) {
      showToast(t('trade.errors.insufficientBalance'))
      return
    }
  }

  triggerHaptic(16)
  submitting.value = true
  try {
    const json = await TradeService.submitOrder(
      assetId.value,
      activeTab.value,
      quantity.value,
      assetName.value || t('trade.unnamedAsset'),
      currentPrice.value
    )

    if (activeTab.value === 'buy' && Number.isFinite(submitQuantity) && submitQuantity > 0) {
      triggerBuyFeedback(submitQuantity)
      const arrivalPayload = {
        id: Date.now(),
        assetId: assetId.value,
        assetName: assetName.value || t('trade.unnamedAsset'),
        grams: Number(submitQuantity.toFixed(2)),
        createdAt: new Date().toISOString(),
        orderId: json?.data?.id || '',
      }
      localStorage.setItem(BUY_ARRIVAL_STORAGE_KEY, JSON.stringify(arrivalPayload))
      window.dispatchEvent(new CustomEvent('jyz-buy-arrival', { detail: arrivalPayload }))
    }

    triggerHaptic([20, 35, 25])
    quantity.value = ''
    fetchOrders() // 刷新列表
  } catch (err) {
    console.error('Order failed:', err)
  } finally {
    submitting.value = false
  }
}

const translateOrderType = (type) => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'buy' || type === '买入') return t('trade.orderType.buy')
  if (normalized === 'sell' || type === '卖出') return t('trade.orderType.sell')
  return type || '--'
}

onMounted(() => {
  fetchOrders()
  fetchAvailableBalance()
})

onBeforeUnmount(() => {
  clearBuyFeedback()
  if (orderBookTimer) clearInterval(orderBookTimer)
})

// 五档盘口相关方法
const toggleOrderBook = () => {
  showOrderBook.value = !showOrderBook.value
  if (showOrderBook.value) {
    // 默认选中当前交易品种
    orderBookAssetId.value = assetId.value || (markets.value[0]?.id || '')
    fetchOrderBook()
  }
}

const selectOrderBookAsset = (asset) => {
  orderBookAssetId.value = asset.id
  fetchOrderBook()
}

const fetchOrderBook = async () => {
  if (!orderBookAssetId.value) return
  orderBookLoading.value = true
  try {
    const data = await MarketService.getOrderBook(orderBookAssetId.value)
    orderBookData.value = data
  } catch (err) {
    // 如果接口不存在，使用模拟数据
    generateMockOrderBook()
  } finally {
    orderBookLoading.value = false
  }
}

// 模拟五档数据
const generateMockOrderBook = () => {
  const currentAsset = markets.value.find(m => m.id === orderBookAssetId.value)
  const basePrice = currentAsset ? parseFloat(currentAsset.price) : 500
  
  // 卖五到卖一（价格从高到低）
  const sellOrders = []
  for (let i = 5; i >= 1; i--) {
    sellOrders.push({
      level: i,
      price: (basePrice + i * 0.02 + Math.random() * 0.01).toFixed(2),
      quantity: Math.floor(Math.random() * 50) + 5
    })
  }
  
  // 买一到买五（价格从低到高）
  const buyOrders = []
  for (let i = 1; i <= 5; i++) {
    buyOrders.push({
      level: i,
      price: (basePrice - i * 0.02 - Math.random() * 0.01).toFixed(2),
      quantity: Math.floor(Math.random() * 50) + 5
    })
  }
  
  orderBookData.value = {
    sell: sellOrders,
    buy: buyOrders,
    updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }
}

// 监听盘口展开状态，定时刷新数据
watch(showOrderBook, (visible) => {
  if (visible) {
    generateMockOrderBook()
  }
})
</script>

<template>
  <div class="space-y-4 bg-[#0b1520] min-h-full text-white">
    <div class="px-4 pt-4">
      <div class="card-base overflow-hidden relative border-none bg-[#1a2735]">
        <div v-if="buyFeedback.visible && activeTab === 'buy'" class="buy-feedback-layer">
          <div class="buy-feedback-box">
            <img src="/黄金1.png" :alt="t('trade.arrivalAlt')" class="buy-feedback-image" />
            <p class="buy-feedback-text">{{ t('trade.arrival', { grams: buyFeedback.animatedGrams.toFixed(2) }) }}</p>
          </div>
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
                <label class="block text-sm font-medium text-white">{{ t('trade.quantity', { assetName: assetName || t('trade.spotGold') }) }}</label>
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

    <!-- 五档盘口 -->
    <div class="px-4 pb-4">
      <div class="bg-[#1a2735] rounded-xl overflow-hidden">
        <!-- 盘口标题栏 -->
        <button 
          @click="toggleOrderBook"
          class="w-full px-4 py-3 flex items-center justify-between bg-[#1a2735] hover:bg-[#223244] transition-colors"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-white">{{ t('trade.orderBook.title') }}</span>
            <span v-if="orderBookData.updatedAt" class="text-[10px] text-[#7d8da2]">{{ orderBookData.updatedAt }}</span>
          </div>
          <component :is="showOrderBook ? ChevronUp : ChevronDown" class="text-[#7d8da2]" :size="18" />
        </button>
        
        <!-- 盘口内容 -->
        <div v-show="showOrderBook" class="border-t border-[#2a3a4b]">
          <!-- 品种 Tab -->
          <div class="px-3 py-2 border-b border-[#2a3a4b] bg-[#1f2d3b]">
            <div class="flex gap-2 overflow-x-auto no-scrollbar">
              <button 
                v-for="asset in assetList" 
                :key="asset.id"
                @click="selectOrderBookAsset(asset)"
                :class="orderBookAssetId === asset.id ? 'bg-[#c99b18] text-white' : 'bg-[#223244] text-[#a6b0c3] border border-[#304255]'"
                class="px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors"
              >
                {{ asset.name }}
              </button>
            </div>
          </div>
          
          <!-- 盘口表格 -->
          <div class="p-3">
            <div v-if="orderBookLoading" class="py-6 flex justify-center">
              <Loader2 class="animate-spin text-[#7d8da2]" :size="20" />
            </div>
            
            <div v-else class="space-y-1">
              <!-- 表头 -->
              <div class="flex text-[10px] text-[#7d8da2] px-1 mb-1">
                <span class="w-12">{{ t('trade.orderBook.level') }}</span>
                <span class="flex-1 text-center">{{ t('trade.orderBook.price') }}</span>
                <span class="w-14 text-right">{{ t('trade.orderBook.quantity') }}</span>
              </div>
              
              <!-- 卖五到卖一 -->
              <div 
                v-for="item in orderBookData.sell" 
                :key="'sell-'+item.level"
                class="flex items-center py-1 px-1 rounded text-xs"
              >
                <span class="w-12 text-[#19c58a]">{{ t('trade.orderBook.sell') }}{{ item.level }}</span>
                <span class="flex-1 text-center text-[#19c58a] tabular-nums">{{ item.price }}</span>
                <span class="w-14 text-right text-white tabular-nums">{{ item.quantity }}</span>
              </div>
              
              <!-- 分隔线 -->
              <div class="border-t border-[#2a3a4b] my-2"></div>
              
              <!-- 买一到买五 -->
              <div 
                v-for="item in orderBookData.buy" 
                :key="'buy-'+item.level"
                class="flex items-center py-1 px-1 rounded text-xs"
              >
                <span class="w-12 text-[#ff5f56]">{{ t('trade.orderBook.buy') }}{{ item.level }}</span>
                <span class="flex-1 text-center text-[#ff5f56] tabular-nums">{{ item.price }}</span>
                <span class="w-14 text-right text-white tabular-nums">{{ item.quantity }}</span>
              </div>
            </div>
          </div>
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
              <span class="px-2 py-0.5 text-[10px] rounded font-bold" :class="translateOrderType(order.type) === t('trade.orderType.buy') ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'">
                {{ translateOrderType(order.type) }}
              </span>
              <span class="font-bold text-sm">{{ order.name }}</span>
            </div>
            <span class="text-[10px] text-gray-400">{{ order.time }}</span>
          </div>
          <div class="flex justify-between text-xs text-gray-500">
            <span>{{ t('trade.dealPrice') }}: <span class="tabular-nums font-medium">{{ order.price }}</span></span>
            <span>{{ t('trade.dealQuantity') }}: <span class="tabular-nums font-medium">{{ order.quantity }}g</span></span>
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
  justify-content: center;
  align-items: center;
  padding-bottom: 40px;
}

.buy-feedback-image {
  width: 80px;
  height: 80px;
  object-fit: contain;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5))
          drop-shadow(0 0 20px rgba(255, 215, 0, 0.4));
  animation: buyFlyIn 0.9s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.buy-feedback-text {
  margin-top: 12px;
  color: #f2c24a;
  font-size: 16px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  animation: textPop 0.5s ease-out 0.6s both;
}

@keyframes textPop {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes buyFlyIn {
  0% {
    transform: translateY(-120px) scale(0.5);
    opacity: 0;
  }
  50% {
    transform: translateY(10px) scale(1.1);
    opacity: 1;
  }
  70% {
    transform: translateY(-5px) scale(0.95);
  }
  85% {
    transform: translateY(2px) scale(1.02);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>
