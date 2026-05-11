<script setup>
import { Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Shield, ChevronRight, Settings, LogOut, Eye, EyeOff, Repeat, UserCheck, ShieldAlert } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onActivated, onBeforeUnmount, computed } from 'vue'
import ImageCarousel from '../components/ImageCarousel.vue'
import { UserService } from '../services/user'
import { AuthService } from '../services/auth'
import { useToast } from '../composables/useToast'
import RechargeModal from '../components/profile/RechargeModal.vue'
import WithdrawModal from '../components/profile/WithdrawModal.vue'

defineOptions({ name: 'Profile' })

const { t, locale } = useI18n()
const router = useRouter()
const { showToast } = useToast()
const assetType = ref('gold') // 'gold' | 'silver'
const showAmount = ref(true)
const isRefreshing = ref(false)
const showRechargeModal = ref(false)
const showWithdrawModal = ref(false)
const BUY_EVENT_NAME = 'jyz-buy-arrival'
const BUY_EVENT_STORAGE_KEY = 'jyz_last_buy_arrival'
const SPEC_GRAMS = [10, 50, 100, 1000, 5000]
const holdDeltaGrams = ref({ gold: 0, silver: 0 })
const processedEventIds = ref(new Set())

// 用户充值状态和收款方式
const hasRecharged = ref(false)
const paymentMethod = ref(null)

const userProfile = ref({
  username: t('profile.loading'),
  id: '-------',
  avatar: '',
  assets: [],
  goldPositions: [],
  silverPositions: [],
  realNameVerified: false
})

// 头像加载失败状态
const avatarError = ref(false)

// 处理头像加载失败
const handleAvatarError = () => {
  avatarError.value = true
}

// 实名认证状态
const isRealNameVerified = computed(() => userProfile.value.realNameVerified || false)

// 使用计算属性匹配资产字段，防止索引错位
const getAssetByIndex = (index) => {
  return userProfile.value.assets[index] || { key: '', value: '0.00', unit: '' }
}

const fetchProfile = async (silent = false) => {
  if (!silent) isRefreshing.value = true
  try {
    const json = await UserService.getProfile()
    userProfile.value = json.data

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
    if (storedUser?.avatar) {
      userProfile.value.avatar = storedUser.avatar
    }
    if (storedUser?.nickname) {
      userProfile.value.nickname = storedUser.nickname
    }

    // 重置头像错误状态
    avatarError.value = false
  } catch (err) {
    console.error('Failed to fetch profile:', err)
  } finally {
    isRefreshing.value = false
  }
}

// 获取用户充值状态和收款方式
const fetchUserPaymentInfo = async () => {
  try {
    // 检查是否有充值记录
    const rechargeResponse = await UserService.hasRechargeHistory()
    hasRecharged.value = rechargeResponse.data || false
    
    // 获取已绑定的收款方式
    const methodResponse = await UserService.getPaymentMethod()
    paymentMethod.value = methodResponse.data || null
  } catch (err) {
    console.error('Failed to fetch payment info:', err)
  }
}

const toggleAmount = () => {
  showAmount.value = !showAmount.value
}

const showComingSoon = () => {
  showToast(t('profile.comingSoon'))
}

const parseAmount = (value) => {
  const amount = Number(String(value || 0).replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

const availableBalance = computed(() => parseAmount(getAssetByIndex(1).value))

const handleRechargeSuccess = () => {
  showToast(t('profile.rechargeSuccess'))
  fetchProfile(true)
  // 充值成功后更新充值状态
  hasRecharged.value = true
}

const handleWithdrawSuccess = () => {
  showToast(t('profile.withdrawSubmitted'))
  fetchProfile(true)
}

const handleBindPaymentMethod = (method) => {
  paymentMethod.value = method
}

const logout = async () => {
  await AuthService.logout()
  router.push('/login')
}

const formatCurrency = (value) => {
  const num = parseFloat(String(value).replace(/,/g, ''))
  if (isNaN(num)) return '¥0.00'
  const selectedLocale = getNumberLocale()
  return '¥' + num.toLocaleString(selectedLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getNumberLocale = () => {
  const localeMap = {
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-ES',
    ar: 'ar-SA',
    hi: 'hi-IN',
    ru: 'ru-RU',
    ja: 'ja-JP',
    pt: 'pt-BR',
    bn: 'bn-BD',
  }
  return localeMap[String(locale.value || '').toLowerCase()] || 'en-US'
}

const goldSummary = computed(() => {
  let totalWeight = 0
  let totalValue = 0
  const positions = userProfile.value.goldPositions || []
  positions.forEach(item => {
    const weight = parseFloat(item.weight) || 0
    const count = parseFloat(item.count) || 0
    const price = parseFloat(String(item.price).replace(/,/g, '')) || 0
    totalWeight += weight * count
    totalValue += price * count
  })
  return { weight: totalWeight.toFixed(2), value: formatCurrency(totalValue.toFixed(2)) }
})

const silverSummary = computed(() => {
  let totalWeight = 0
  let totalValue = 0
  const positions = userProfile.value.silverPositions || []
  positions.forEach(item => {
    const weight = parseFloat(item.weight) || 0
    const count = parseFloat(item.count) || 0
    const price = parseFloat(String(item.price).replace(/,/g, '')) || 0
    totalWeight += weight * count
    totalValue += price * count
  })
  return { weight: totalWeight.toFixed(2), value: formatCurrency(totalValue.toFixed(2)) }
})

// 动画相关状态
const animatingItems = ref(new Set())
const flyInItems = ref(new Set())
const displayedCounts = ref({})
const showArrivalFeedback = ref(false)
const arrivalFeedbackText = ref('')
let arrivalTimer = null

// 数字跳动动画
const animateNumber = (key, targetValue, duration = 800) => {
  const startTime = performance.now()
  const startValue = 0
  
  const updateNumber = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 3)
    const currentValue = startValue + (targetValue - startValue) * easeOut
    
    displayedCounts.value[key] = currentValue.toFixed(2)
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber)
    } else {
      displayedCounts.value[key] = targetValue.toFixed(2)
    }
  }
  
  requestAnimationFrame(updateNumber)
}

const parseGram = (weight) => {
  const gram = Number(String(weight || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(gram) ? gram : 0
}

const resolveAssetType = (payload) => {
  const name = String(payload?.assetName || '')
  const id = String(payload?.assetId || '').toUpperCase()
  return name.includes('银') || id.includes('AG') ? 'silver' : 'gold'
}

const getDefaultImageByGram = (type, gram) => {
  const goldMap = {
    10: '/影子金币10g黄金.jpg',
    50: '/金叶币50g黄金.png',
    100: '/龙币100g黄金.png',
    1000: '/黄金条1000g黄金.png',
    5000: '/黄金砖5000g黄金.jpg',
  }
  const silverMap = {
    10: '/影子金币_银.jpg',
    50: '/金叶币50g白银.png',
    100: '/龙币100g白银.png',
    1000: '/黄金条1000g白银.jpg',
    5000: '/黄金砖5000g白银.png',
  }
  const map = type === 'gold' ? goldMap : silverMap
  return map[gram] || map[10]
}

const getBaseTotalGrams = (type) => {
  const source = type === 'gold' ? userProfile.value.goldPositions : userProfile.value.silverPositions
  return source.reduce((sum, item) => sum + parseGram(item.weight) * Number(item.count || 0), 0)
}

const normalizeCountsByTotal = (totalGrams) => {
  const counts = {}
  let remaining = Number(totalGrams || 0)
  const descending = [...SPEC_GRAMS].sort((a, b) => b - a)

  descending.forEach((gram) => {
    const count = Math.floor(remaining / gram)
    counts[gram] = count
    remaining = Number((remaining - count * gram).toFixed(4))
  })
  return counts
}

const buildDisplayPositionsByType = (type) => {
  const source = type === 'gold' ? userProfile.value.goldPositions : userProfile.value.silverPositions
  const totalGrams = getBaseTotalGrams(type) + Number(holdDeltaGrams.value[type] || 0)
  const counts = normalizeCountsByTotal(totalGrams)
  const sourceByGram = new Map()

  source.forEach((item) => {
    const gram = parseGram(item.weight)
    if (!gram || sourceByGram.has(gram)) return
    sourceByGram.set(gram, item)
  })

  return SPEC_GRAMS.map((gram) => {
    const src = sourceByGram.get(gram)
    const count = Number(counts[gram] || 0)
    const unitPrice = parseAmount(src?.price || 0)
    const totalPrice = unitPrice * count
    return {
      level: `${type === 'gold' ? t('profile.gold') : t('profile.silver')}${gram}g`,
      weight: String(gram),
      count,
      price: totalPrice.toLocaleString(getNumberLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bgImage: src?.bgImage || getDefaultImageByGram(type, gram),
      gram,
    }
  })
}

const displayPositions = computed(() => buildDisplayPositionsByType(assetType.value))

// 触发买入成功动画
const triggerBuyAnimation = (itemKey, weight, count) => {
  // 飞入动画
  flyInItems.value.add(itemKey)
  
  // 数字跳动动画
  const numericWeight = parseFloat(weight) || 0
  animateNumber(itemKey, numericWeight)
  
  // 显示到账反馈
  arrivalFeedbackText.value = t('profile.arrivalFeedback', { grams: Number(weight || 0).toFixed(2) })
  showArrivalFeedback.value = true
  
  // 清除飞入动画状态
  setTimeout(() => {
    flyInItems.value.delete(itemKey)
  }, 1000)
  
  // 隐藏到账反馈
  if (arrivalTimer) clearTimeout(arrivalTimer)
  arrivalTimer = setTimeout(() => {
    showArrivalFeedback.value = false
  }, 2500)
}

// 获取显示的数字
const getDisplayedWeight = (item) => {
  const key = `${assetType.value}-${item.gram}`
  if (displayedCounts.value[key] !== undefined) {
    return displayedCounts.value[key]
  }
  return Number(item.weight || 0).toFixed(0)
}

// 检查是否正在飞入动画
const isFlyingIn = (item) => {
  const key = `${assetType.value}-${item.gram}`
  return flyInItems.value.has(key)
}

// 获取金币显示数量（用于v-for循环）
const getCoinCount = (count) => {
  const num = parseInt(count) || 0
  // 业务规则：持有数为 0 也必须展示 1 张图，保证界面始终有图示
  return Math.max(num, 1)
}

const handleBuyArrival = (payload) => {
  const grams = Number(payload?.grams || 0)
  if (!Number.isFinite(grams) || grams <= 0) return

  const id = payload?.id || `${payload?.createdAt || Date.now()}_${grams}`
  if (processedEventIds.value.has(id)) return
  processedEventIds.value.add(id)

  const type = resolveAssetType(payload)
  const beforeCounts = normalizeCountsByTotal(getBaseTotalGrams(type) + Number(holdDeltaGrams.value[type] || 0))
  holdDeltaGrams.value[type] = Number((Number(holdDeltaGrams.value[type] || 0) + grams).toFixed(4))
  const afterCounts = normalizeCountsByTotal(getBaseTotalGrams(type) + Number(holdDeltaGrams.value[type] || 0))

  SPEC_GRAMS.forEach((gram) => {
    const inc = Number(afterCounts[gram] || 0) - Number(beforeCounts[gram] || 0)
    if (inc > 0) {
      const key = `${type}-${gram}`
      triggerBuyAnimation(key, gram, inc)
    }
  })
}

const buyEventHandler = (event) => handleBuyArrival(event?.detail)

const consumeStoredBuyEvent = () => {
  const raw = localStorage.getItem(BUY_EVENT_STORAGE_KEY)
  if (!raw) return
  try {
    const payload = JSON.parse(raw)
    handleBuyArrival(payload)
  } finally {
    localStorage.removeItem(BUY_EVENT_STORAGE_KEY)
  }
}

onMounted(() => {
  fetchProfile()
  fetchUserPaymentInfo()
  consumeStoredBuyEvent()
  window.addEventListener(BUY_EVENT_NAME, buyEventHandler)
})

onActivated(() => {
  fetchProfile(true)
  fetchUserPaymentInfo()
  consumeStoredBuyEvent()
})

onBeforeUnmount(() => {
  window.removeEventListener(BUY_EVENT_NAME, buyEventHandler)
  if (arrivalTimer) clearTimeout(arrivalTimer)
})
</script>

<template>
  <div class="space-y-4 pb-10">
    <!-- User Info -->
    <div class="bg-white dark:bg-gray-800 px-4 py-8 flex items-center gap-4">
      <div class="w-16 h-16 bg-primary/10 rounded-full overflow-hidden flex items-center justify-center text-primary text-2xl font-bold border-2 border-primary/20">
        <img v-if="userProfile.avatar && !avatarError" :src="userProfile.avatar" class="w-full h-full object-cover" @error="handleAvatarError" />
        <span v-else>{{ userProfile.nickname?.charAt(0) || 'U' }}</span>
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-xl font-bold">{{ userProfile.nickname }}</h3>
          <!-- 实名认证状态标识 -->
          <div 
            v-if="isRealNameVerified" 
            class="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-[10px] font-medium"
          >
            <UserCheck :size="12" />
            <span>{{ t('profile.verified') }}</span>
          </div>
          <div 
            v-else 
            class="flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-[10px] font-medium"
          >
            <ShieldAlert :size="12" />
            <span>{{ t('profile.unverified') }}</span>
          </div>
        </div>
        <p class="text-xs text-gray-400">{{ t('profile.idPrefix') }} {{ userProfile.id }}</p>
      </div>
      <button @click="router.push('/settings')" class="ml-auto text-gray-400 btn-interact p-2"><Settings :size="20" /></button>
    </div>

    <!-- Operations -->
    <div class="px-4">
      <div class="card-base p-4 flex flex-col gap-6 relative">
        
        <div class="flex justify-around">
          <button @click="showRechargeModal = true" class="flex flex-col items-center gap-2 btn-interact">
            <div class="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center">
              <ArrowUpCircle :size="24" />
            </div>
            <span class="text-[11px] font-bold">{{ t('profile.recharge') }}</span>
          </button>

          <button @click="showWithdrawModal = true" class="flex flex-col items-center gap-2 btn-interact">
            <div class="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center">
              <ArrowDownCircle :size="24" />
            </div>
            <span class="text-[11px] font-bold">{{ t('profile.withdraw') }}</span>
          </button>

          <button @click="showComingSoon" class="flex flex-col items-center gap-2 btn-interact">
            <div class="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
              <RefreshCw :size="24" />
            </div>
            <span class="text-[11px] font-bold">{{ t('profile.transfer') }}</span>
          </button>

          <button @click="showComingSoon" class="flex flex-col items-center gap-2 btn-interact">
            <div class="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-full flex items-center justify-center">
              <Repeat :size="24" />
            </div>
            <span class="text-[11px] font-bold">{{ t('profile.exchange') }}</span>
          </button>
        </div>

    </div>

    </div>

    <!-- Assets Display -->
    <div class="px-4">
      <div class="bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 text-white shadow-xl min-h-[160px] flex flex-col justify-center relative overflow-hidden">
        <div class="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        
        <template v-if="userProfile.assets && userProfile.assets.length > 0">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <p class="text-gray-400 text-xs">{{ t(getAssetByIndex(0).key) }} ({{ getAssetByIndex(0).unit }})</p>
                <button @click="toggleAmount" class="text-gray-500 hover:text-white transition-colors btn-interact">
                  <component :is="showAmount ? Eye : EyeOff" :size="14" />
                </button>
              </div>
              <h2 class="text-3xl font-bold tabular-nums leading-none">
                {{ showAmount ? getAssetByIndex(0).value : '****' }}
              </h2>
            </div>
            <div class="self-end pl-6">
              <p class="text-gray-400 text-[10px] mb-1">{{ t('profile.tempAssets') }}</p>
              <p class="font-bold text-sm tabular-nums leading-none">
                {{ showAmount ? '¥' + getAssetByIndex(5).value : '****' }}
              </p>
            </div>

            <div>
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(4).key) }}</p>
              <p class="font-bold text-sm tabular-nums" :class="getAssetByIndex(4).trend === 'up' ? 'text-red-400' : ''">
                {{ showAmount ? getAssetByIndex(4).value : '****' }}
              </p>
            </div>
            <div class="pl-6">
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(2).key) }}</p>
              <p class="font-bold text-sm tabular-nums">{{ showAmount ? getAssetByIndex(2).value : '****' }}</p>
            </div>

            <div>
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(3).key) }}</p>
              <p class="font-bold text-sm tabular-nums" :class="getAssetByIndex(3).trend === 'up' ? 'text-red-400' : ''">
                {{ showAmount ? getAssetByIndex(3).value : '****' }}
              </p>
            </div>
            <div class="pl-6">
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(1).key) }}</p>
              <p class="font-bold text-sm tabular-nums">{{ showAmount ? getAssetByIndex(1).value : '****' }}</p>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-white/10 space-y-2">
            <div class="flex justify-between items-center text-sm">
              <span class="text-yellow-400 font-bold">{{ t('profile.gold') }}</span>
              <div class="flex gap-4">
                <span class="text-gray-300">{{ showAmount ? goldSummary.weight + ' g' : '****' }}</span>
                <span class="text-gray-300">{{ showAmount ? goldSummary.value : '****' }}</span>
              </div>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-blue-300 font-bold">{{ t('profile.silver') }}</span>
              <div class="flex gap-4">
                <span class="text-gray-300">{{ showAmount ? silverSummary.weight + ' g' : '****' }}</span>
                <span class="text-gray-300">{{ showAmount ? silverSummary.value : '****' }}</span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="text-center text-gray-500 text-sm">
          {{ t('profile.loading') }}
        </div>
      </div>
    </div>
    
    <!-- Positions Display with Toggle -->
    <div class="px-4 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg px-1">{{ t('profile.myGold') }}</h3>
        <div class="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button 
            @click="assetType = 'gold'"
            :class="assetType === 'gold' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'"
            class="px-4 py-1 rounded-lg text-[11px] font-bold transition-all btn-interact"
          >
            {{ t('profile.gold') }}
          </button>
          <button 
            @click="assetType = 'silver'"
            :class="assetType === 'silver' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'"
            class="px-4 py-1 rounded-lg text-[11px] font-bold transition-all btn-interact"
          >
            {{ t('profile.silver') }}
          </button>
        </div>
      </div>

      <ImageCarousel :items="displayPositions">
        <template #default="{ item, index }">
          <div class="w-full h-full relative group overflow-hidden rounded-2xl gold-card" :class="assetType === 'silver' ? 'silver-card' : ''">
            <!-- 遮罩层 - 放在金币下面 -->
            <div class="absolute inset-0 bg-black/20 dark:bg-black/40"></div>

            <!-- 金币堆叠层 - 根据持有份数显示多个金币 -->
            <div class="gold-stack-container" style="z-index: 1;">
              <div class="coin-stack-wrapper">
                <div 
                  v-for="coinIdx in getCoinCount(item.count)" 
                  :key="coinIdx"
                  class="gold-coin"
                  :class="{ 'fly-in-bounce': isFlyingIn(item) && coinIdx === parseInt(item.count || 0), 'silver-coin': assetType === 'silver' }"
                  :style="{
                    backgroundImage: `url(${item.bgImage})`,
                    zIndex: coinIdx,
                    bottom: `${(coinIdx - 1) * 8}px`,
                    animationDelay: `${(coinIdx - 1) * 0.15}s`
                  }"
                ></div>
              </div>
            </div>

            <!-- Glow Effect on Hover -->
            <div class="gold-glow absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" :class="assetType === 'silver' ? 'silver-glow' : ''" style="z-index: 2;"></div>

            <!-- Content -->
            <div class="relative h-full p-5 flex flex-col justify-between text-white" style="z-index: 3;">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span 
                    class="px-2 py-0.5 text-[10px] rounded-full font-bold shadow-sm"
                    :class="assetType === 'gold' ? 'bg-yellow-500 text-black' : 'bg-gray-300 text-black'"
                  >
                    LV.{{ assetType === 'gold' ? 'G' : 'S' }}
                  </span>
                  <h4 class="font-bold drop-shadow-md text-sm">{{ item.level }}</h4>
                </div>
                <p class="text-[10px] text-white/80 font-medium">{{ t('profile.currentHold') }} <span class="text-white font-bold">{{ item.count }} {{ t('profile.shareUnit') }}</span></p>
              </div>

              <div class="space-y-2">
                <div class="flex justify-between items-end">
                  <div>
                    <p class="text-[9px] text-white/70 uppercase font-bold">{{ t('profile.weight') }}</p>
                    <p class="text-sm font-bold">{{ getDisplayedWeight(item) }} g</p>
                  </div>
                  <div class="text-right">
                    <p class="text-[9px] text-white/70 uppercase font-bold">{{ t('profile.marketValue') }}</p>
                    <p class="text-lg font-bold" :class="assetType === 'gold' ? 'text-yellow-400' : 'text-blue-200'">¥ {{ item.price }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </ImageCarousel>

      <!-- Arrival Feedback Toast -->
      <Transition name="arrival">
        <div v-if="showArrivalFeedback" class="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div class="arrival-feedback px-6 py-3 rounded-full font-bold text-white shadow-2xl">
            <span class="flex items-center gap-2">
              <span class="text-yellow-400 text-xl">✦</span>
              {{ arrivalFeedbackText }}
              <span class="text-yellow-400 text-xl">✦</span>
            </span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Menu List -->
    <div class="px-4">
      <div class="card-base divide-y divide-gray-50 dark:divide-gray-700/50 overflow-hidden">
        <button class="w-full flex items-center gap-4 p-4 active:bg-gray-50 dark:active:bg-gray-700 transition-colors text-left btn-interact">
          <Shield class="text-gray-400" :size="20" />
          <span class="flex-1 font-bold text-sm">{{ t('profile.security') }}</span>
          <ChevronRight class="text-gray-300" :size="20" />
        </button>
        <button class="w-full flex items-center gap-4 p-4 active:bg-gray-50 dark:active:bg-gray-700 transition-colors text-left btn-interact">
          <Wallet class="text-gray-400" :size="20" />
          <span class="flex-1 font-bold text-sm">{{ t('profile.holdings') }}</span>
          <ChevronRight class="text-gray-300" :size="20" />
        </button>
        <button @click="logout" class="w-full flex items-center gap-4 p-4 active:bg-gray-50 dark:active:bg-gray-700 transition-colors text-left text-danger btn-interact">
          <LogOut :size="20" />
          <span class="flex-1 font-bold text-sm">{{ t('profile.logout') }}</span>
          <ChevronRight class="text-gray-300" :size="20" />
        </button>
      </div>
    </div>

  </div>

  <RechargeModal
    :visible="showRechargeModal"
    @close="showRechargeModal = false"
    @success="handleRechargeSuccess"
  />

  <WithdrawModal
    :visible="showWithdrawModal"
    :available-balance="availableBalance"
    :has-recharged="hasRecharged"
    :payment-method="paymentMethod"
    @close="showWithdrawModal = false"
    @success="handleWithdrawSuccess"
    @bind-payment-method="handleBindPaymentMethod"
  />
</template>

<style scoped>
/* 金币堆叠容器 - 定位在卡片上半部分 */
.gold-stack-container {
  position: absolute;
  top: 34%;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 50%;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* 金币堆叠包装器 */
.coin-stack-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

/* 单个金币样式 */
.gold-coin {
  position: absolute;
  width: 100%;
  height: 100%;
  background-size: contain;
  background-position: center bottom;
  background-repeat: no-repeat;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5)) 
          drop-shadow(0 3px 6px rgba(184, 134, 11, 0.4));
  transition: all 0.3s ease;
  left: 0;
  animation: coinFloat 3s ease-in-out infinite;
}

/* 金币常态微动动画 - 每个金币有不同的延迟 */
@keyframes coinFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-5px);
  }
}

/* 悬浮时所有金币发光 - 黄金 */
.gold-card:hover .gold-coin {
  filter: 
          drop-shadow(0 0 2px rgba(255, 215, 0, 0.7))
          ;
}

/* 悬浮时所有金币发光 - 白银 */
.silver-card:hover .silver-coin {
  filter: 
          drop-shadow(0 0 2px rgba(192, 192, 192, 0.8))
          drop-shadow(0 0 2px rgba(220, 220, 220, 0.5))
          ;
}

/* 常态时白银也有银色阴影 */
.silver-coin {
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5)) 
          drop-shadow(0 3px 6px rgba(192, 192, 192, 0.3));
}

/* 悬浮时金币散开效果 - 使用 bottom 属性 */
.gold-card:hover .gold-coin:nth-child(1) { bottom: 0px !important; }
.gold-card:hover .gold-coin:nth-child(2) { bottom: 8px !important; }
.gold-card:hover .gold-coin:nth-child(3) { bottom: 12px !important; }
.gold-card:hover .gold-coin:nth-child(4) { bottom: 16px !important; }
.gold-card:hover .gold-coin:nth-child(5) { bottom: 20px !important; }

/* 更多金币指示器 - 黄金 */
.coin-more-indicator {
  position: absolute;
  bottom: 20%;
  right: 20%;
  background: linear-gradient(135deg, #b8860b 0%, #8b5a00 100%);
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 10;
  border: 2px solid rgba(255, 215, 0, 0.5);
}

/* 更多金币指示器 - 白银 */
.silver-indicator {
  background: linear-gradient(135deg, #a0a0a0 0%, #707070 100%);
  border: 2px solid rgba(220, 220, 220, 0.5);
}

.gold-glow {
  background: radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, transparent 70%);
}

/* 白银发光效果 */
.silver-glow {
  background: radial-gradient(ellipse at center, rgba(192, 192, 192, 0.2) 0%, transparent 70%);
}

/* 飞入弹跳动画 */
@keyframes flyInBounce {
  0% {
    transform: translateY(150%);
    opacity: 0;
  }
  50% {
    transform: translateY(-30%);
    opacity: 1;
  }
  70% {
    transform: translateY(15%);
  }
  85% {
    transform: translateY(-8%);
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.fly-in-bounce {
  animation: flyInBounce 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards, coinFloat 3s ease-in-out infinite 0.8s;
}

/* 到账反馈动画 */
@keyframes arrivalPulse {
  0% {
    transform: translateX(-50%) scale(0.8);
    opacity: 0;
  }
  20% {
    transform: translateX(-50%) scale(1.05);
    opacity: 1;
  }
  40% {
    transform: translateX(-50%) scale(0.98);
  }
  60% {
    transform: translateX(-50%) scale(1.02);
  }
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
}

.arrival-feedback {
  background: linear-gradient(135deg, rgba(184, 134, 11, 0.95) 0%, rgba(139, 90, 0, 0.95) 100%);
  border: 2px solid rgba(255, 215, 0, 0.5);
  box-shadow: 0 10px 40px rgba(184, 134, 11, 0.4), 0 0 20px rgba(255, 215, 0, 0.3);
  animation: arrivalPulse 0.5s ease-out;
}

/* 过渡动画 */
.arrival-enter-active,
.arrival-leave-active {
  transition: all 0.4s ease;
}

.arrival-enter-from,
.arrival-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px) scale(0.9);
}

/* 卡片悬浮时的整体效果 */
.gold-card {
  transition: all 0.3s ease;
}

.gold-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 215, 0, 0.1);
}
</style>
