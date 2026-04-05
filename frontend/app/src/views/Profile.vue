<script setup>
import { Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Shield, ChevronRight, LogOut, Eye, EyeOff, Repeat } from 'lucide-vue-next'
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

const assetType = ref('gold')
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

const getAssetByIndex = (index) => userProfile.value.assets?.[index] || { key: '', value: '0.00', unit: '' }

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

onMounted(() => fetchProfile())
onActivated(() => fetchProfile(true))

const toggleAmount = () => {
  showAmount.value = !showAmount.value
}

const showComingSoon = () => showToast(t('profile.comingSoon'))

const logout = async () => {
  await AuthService.logout()
  router.push('/login')
}

const formatCurrency = (value) => {
  const num = parseFloat(String(value).replace(/,/g, ''))
  if (Number.isNaN(num)) return '¥0.00'
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const positions = computed(() => (assetType.value === 'gold' ? userProfile.value.goldPositions || [] : userProfile.value.silverPositions || []))

const summary = computed(() => {
  let totalWeight = 0
  let totalValue = 0
  positions.value.forEach((item) => {
    const weight = parseFloat(String(item.weight || '').replace('g', '')) || 0
    const count = parseFloat(item.count) || 0
    const price = parseFloat(String(item.price).replace(/,/g, '')) || 0
    totalWeight += weight * count
    totalValue += price * count
  })
  return {
    weight: totalWeight.toFixed(2),
    value: formatCurrency(totalValue)
  }
})
</script>

<template>
  <div class="space-y-4 pb-6">
    <section class="px-4 pt-2">
      <div class="card-base p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-bold text-base">{{ userProfile.username }}</h3>
            <p class="text-xs text-gray-400">{{ t('profile.idPrefix') }} {{ userProfile.id }}</p>
          </div>
          <button class="btn-interact p-2 rounded-lg bg-gray-100 text-gray-600" @click="fetchProfile()" :disabled="isRefreshing">
            <RefreshCw :size="16" :class="{ 'animate-spin': isRefreshing }" />
          </button>
        </div>

        <div class="grid grid-cols-4 gap-2">
          <button class="quick-btn" @click="showComingSoon"><ArrowUpCircle :size="16" />{{ t('profile.recharge') }}</button>
          <button class="quick-btn" @click="showComingSoon"><ArrowDownCircle :size="16" />{{ t('profile.withdraw') }}</button>
          <button class="quick-btn" @click="showComingSoon"><Repeat :size="16" />{{ t('profile.transfer') }}</button>
          <button class="quick-btn" @click="showComingSoon"><Wallet :size="16" />{{ t('profile.exchange') }}</button>
        </div>
      </div>
    </section>

    <section class="px-4">
      <div class="card-base p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-sm">{{ t('profile.tempAssets') }}</h4>
          <button class="btn-interact p-1 text-gray-500" @click="toggleAmount">
            <Eye v-if="showAmount" :size="16" />
            <EyeOff v-else :size="16" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="asset-item">
            <p class="asset-label">{{ t(getAssetByIndex(0).key || 'profile.assets.total') }}</p>
            <p class="asset-value">{{ showAmount ? formatCurrency(getAssetByIndex(0).value) : '****' }}</p>
          </div>
          <div class="asset-item">
            <p class="asset-label">{{ t(getAssetByIndex(1).key || 'profile.assets.balance') }}</p>
            <p class="asset-value">{{ showAmount ? formatCurrency(getAssetByIndex(1).value) : '****' }}</p>
          </div>
          <div class="asset-item">
            <p class="asset-label">{{ t(getAssetByIndex(2).key || 'profile.assets.marketValue') }}</p>
            <p class="asset-value">{{ showAmount ? formatCurrency(getAssetByIndex(2).value) : '****' }}</p>
          </div>
          <div class="asset-item">
            <p class="asset-label">{{ t(getAssetByIndex(3).key || 'profile.assets.accumulatedProfit') }}</p>
            <p class="asset-value">{{ showAmount ? formatCurrency(getAssetByIndex(3).value) : '****' }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="px-4">
      <div class="card-base p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="inline-flex p-1 rounded-lg bg-gray-100">
            <button class="tab-btn" :class="{ active: assetType === 'gold' }" @click="assetType = 'gold'">{{ t('profile.gold') }}</button>
            <button class="tab-btn" :class="{ active: assetType === 'silver' }" @click="assetType = 'silver'">{{ t('profile.silver') }}</button>
          </div>
          <div class="text-right text-xs">
            <p class="text-gray-400">{{ t('profile.currentHold') }}</p>
            <p class="font-bold">{{ summary.weight }} g</p>
            <p class="text-amber-600 font-bold">{{ showAmount ? summary.value : '****' }}</p>
          </div>
        </div>

        <ImageCarousel :items="positions">
          <template #default="{ item }">
            <div class="w-full h-full rounded-2xl p-4 text-white relative overflow-hidden bg-slate-800">
              <div class="absolute inset-0 bg-cover bg-center opacity-45" :style="{ backgroundImage: `url(${item.bgImage})` }"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20"></div>
              <div class="relative z-10">
                <h5 class="font-bold text-base">{{ item.level }}</h5>
                <p class="text-xs text-white/80 mt-1">{{ t('profile.weight') }}: {{ item.weight }}</p>
                <p class="text-xs text-white/80">{{ t('profile.currentHold') }} {{ item.count }} g</p>
                <p class="mt-2 text-lg font-bold text-amber-300">¥{{ item.price }}</p>
              </div>
            </div>
          </template>
        </ImageCarousel>
      </div>
    </section>

    <section class="px-4">
      <div class="card-base divide-y divide-gray-100 overflow-hidden">
        <button class="menu-btn" @click="showComingSoon">
          <Shield :size="18" class="text-gray-400" />
          <span class="flex-1">{{ t('profile.security') }}</span>
          <ChevronRight :size="18" class="text-gray-300" />
        </button>
        <button class="menu-btn text-red-500" @click="logout">
          <LogOut :size="18" />
          <span class="flex-1">{{ t('profile.logout') }}</span>
          <ChevronRight :size="18" class="text-gray-300" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
  padding: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #374151;
}

.asset-item {
  border-radius: 0.5rem;
  background: #f9fafb;
  padding: 0.5rem 0.75rem;
}

.asset-label {
  font-size: 11px;
  color: #6b7280;
}

.asset-value {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.tab-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  border-radius: 0.375rem;
}

.tab-btn.active {
  background: #ffffff;
  color: var(--color-primary, #2563eb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.menu-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
}
</style>
