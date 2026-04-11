<script setup>
import { Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Shield, ChevronRight, Settings, LogOut, Eye, EyeOff, Repeat } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, onMounted, onActivated, computed } from 'vue'
import ImageCarousel from '../components/ImageCarousel.vue'
import { UserService } from '../services/user'
import { AuthService } from '../services/auth'
import { useToast } from '../composables/useToast'

defineOptions({ name: 'Profile' })

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()
const assetType = ref('gold') // 'gold' | 'silver'
const showAmount = ref(true)
const isRefreshing = ref(false)

const userProfile = ref({
  username: t('profile.loading'),
  id: '-------',
  avatar: '',
  assets: [],
  goldPositions: [],
  silverPositions: []
})

// 使用计算属性匹配资产字段，防止索引错位
const getAssetByIndex = (index) => {
  return userProfile.value.assets[index] || { key: '', value: '0.00', unit: '' }
}

const fetchProfile = async (silent = false) => {
  if (!silent) isRefreshing.value = true
  try {
    const json = await UserService.getProfile()
    userProfile.value = json.data
  } catch (err) {
    console.error('Failed to fetch profile:', err)
  } finally {
    isRefreshing.value = false
  }
}

onMounted(() => {
  fetchProfile()
})

onActivated(() => {
  fetchProfile(true) // 每次切回页面时自动静默同步数据
})

const toggleAmount = () => {
  showAmount.value = !showAmount.value
}

const showComingSoon = () => {
  showToast(t('profile.comingSoon'))
}

const logout = async () => {
  await AuthService.logout()
  router.push('/login')
}

const formatCurrency = (value) => {
  const num = parseFloat(String(value).replace(/,/g, ''))
  if (isNaN(num)) return '¥0.00'
  return '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
</script>

<template>
  <div class="space-y-4 pb-10">
    <!-- User Info -->
    <div class="bg-white dark:bg-gray-800 px-4 py-8 flex items-center gap-4">
      <div class="w-16 h-16 bg-primary/10 rounded-full overflow-hidden flex items-center justify-center text-primary text-2xl font-bold border-2 border-primary/20">
        <img v-if="userProfile.avatar" :src="userProfile.avatar" class="w-full h-full object-cover" />
        <span v-else>{{ userProfile.nickname?.charAt(0) || 'U' }}</span>
      </div>
      <div>
        <h3 class="text-xl font-bold">{{ userProfile.nickname }}</h3>
        <p class="text-xs text-gray-400">{{ t('profile.idPrefix') }} {{ userProfile.id }}</p>
      </div>
      <button class="ml-auto text-gray-400 btn-interact p-2"><Settings :size="20" /></button>
    </div>

    <!-- Operations -->
    <div class="px-4">
      <div class="card-base p-4 flex flex-col gap-6 relative">
        
        <div class="flex justify-around">
          <button @click="showComingSoon" class="flex flex-col items-center gap-2 btn-interact">
            <div class="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center">
              <ArrowUpCircle :size="24" />
            </div>
            <span class="text-[11px] font-bold">{{ t('profile.recharge') }}</span>
          </button>

          <button @click="showComingSoon" class="flex flex-col items-center gap-2 btn-interact">
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
          <div class="mb-4">
            <div class="flex items-center gap-2 mb-1">
              <p class="text-gray-400 text-xs">{{ t(getAssetByIndex(0).key) }} ({{ getAssetByIndex(0).unit }})</p>
              <button @click="toggleAmount" class="text-gray-500 hover:text-white transition-colors btn-interact">
                <component :is="showAmount ? Eye : EyeOff" :size="14" />
              </button>
            </div>
            <div class="flex items-baseline gap-3">
              <h2 class="text-3xl font-bold tabular-nums">
                {{ showAmount ? getAssetByIndex(0).value : '****' }}
              </h2>
              <span class="text-xs text-gray-400">
                {{ t('profile.tempAssets') }} <span class="text-gray-300">{{ showAmount ? '¥0.00' : '****' }}</span>
              </span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-y-4">
            <div>
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(1).key) }}</p>
              <p class="font-bold text-sm tabular-nums">{{ showAmount ? getAssetByIndex(1).value : '****' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(2).key) }}</p>
              <p class="font-bold text-sm tabular-nums">{{ showAmount ? getAssetByIndex(2).value : '****' }}</p>
            </div>
            <div>
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(3).key) }}</p>
              <p class="font-bold text-sm tabular-nums" :class="getAssetByIndex(3).trend === 'up' ? 'text-red-400' : ''">
                {{ showAmount ? getAssetByIndex(3).value : '****' }}
              </p>
            </div>
            <div>
              <p class="text-gray-400 text-[10px] mb-1">{{ t(getAssetByIndex(4).key) }}</p>
              <p class="font-bold text-sm tabular-nums" :class="getAssetByIndex(4).trend === 'up' ? 'text-red-400' : ''">
                {{ showAmount ? getAssetByIndex(4).value : '****' }}
              </p>
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

      <ImageCarousel :items="assetType === 'gold' ? userProfile.goldPositions : userProfile.silverPositions">
        <template #default="{ item }">
          <div class="w-full h-full relative group overflow-hidden rounded-2xl">
            <!-- Background Image with Overlay -->
            <div 
              class="absolute inset-0 bg-contain bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-110"
              :style="{ backgroundImage: `url(${item.bgImage})` }"
            ></div>
            <div class="absolute inset-0 bg-black/40 dark:bg-black/60"></div>

            <!-- Content -->
            <div class="relative h-full p-5 flex flex-col justify-between text-white">
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
                <p class="text-[10px] text-white/80 font-medium">{{ t('profile.currentHold') }} <span class="text-white font-bold">{{ item.count }} 份</span></p>
              </div>

              <div class="space-y-2">
                <div class="flex justify-between items-end">
                  <div>
                    <p class="text-[9px] text-white/70 uppercase font-bold">{{ t('profile.weight') }}</p>
                    <p class="text-sm font-bold">{{ item.weight }}</p>
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
</template>
