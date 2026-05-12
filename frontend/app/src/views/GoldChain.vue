<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { RefreshCw, ArrowLeft } from 'lucide-vue-next'
import { UserService } from '../services/user'
import { showToast } from '../composables/useToast'

defineOptions({ name: 'GoldChain' })
const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const list = ref([])
let refreshTimer = null

const formatGrams = (value) => {
  return Number(value || 0).toFixed(4)
}

const getAssetName = (assetCode) => {
  const assetNames = {
    'AU9999': 'AU9999 黄金',
    'AU9995': 'AU9995 黄金',
    'AG9999': 'AG9999 白银',
    'AG9995': 'AG9995 白银',
  }
  return assetNames[assetCode] || assetCode || '-'
}

async function fetchChainData() {
  loading.value = true
  try {
    const result = await UserService.getGoldChainRecords()
    const rows = result?.data?.items || result?.data || []

    list.value = Array.isArray(rows)
      ? rows.map((item, index) => ({
          sequenceNo: item.sequenceNo || 100000 + index + 1,
          nickname: String(item.nickname || '匿名用户'),
          assetCode: String(item.assetCode || '-'),
          quantityGrams: formatGrams(item.quantityGrams),
          submittedAt: String(item.submittedAt || '-'),
          orderId: String(item.orderId || '-'),
        }))
      : []
  } catch (error) {
    console.error('Gold chain load failed:', error)
    list.value = []
    showToast('记录加载失败，请重试')
  } finally {
    loading.value = false
  }
}

const startRefreshTimer = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(fetchChainData, 5000)
}

const stopRefreshTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  fetchChainData()
  startRefreshTimer()
})

onUnmounted(() => {
  stopRefreshTimer()
})
</script>

<template>
  <div class="chain-page">
    <header class="chain-header">
      <div class="header-left">
        <button @click="router.back()" class="back-button">
          <ArrowLeft :size="20" />
        </button>
        <div>
          <p class="header-kicker">CHAIN BOARD</p>
          <h1 class="title">{{ t('goldChain.title') }}</h1>
        </div>
      </div>
      <div class="sync-mark">
        <RefreshCw :size="14" class="sync-icon" :class="{ spinning: loading }" />
        <span>{{ loading ? t('goldChain.syncing') : t('goldChain.updated') }}</span>
      </div>
    </header>

    <section class="chain-list">
      <div v-if="loading" class="empty">{{ t('goldChain.loading') }}</div>

      <div v-else-if="list.length === 0" class="empty">{{ t('goldChain.noData') }}</div>

      <div v-else class="chain-table-wrap no-scrollbar">
        <div class="chain-table">
          <div class="chain-row chain-head">
            <span class="col-seq">{{ t('goldChain.columns.sequence') }}</span>
            <span class="col-name">{{ t('goldChain.columns.nickname') }}</span>
            <span class="col-trade">{{ t('goldChain.columns.asset') }}</span>
            <span class="col-gold">{{ t('goldChain.columns.grams') }}</span>
            <span class="col-time">{{ t('goldChain.columns.time') }}</span>
          </div>

          <article v-for="row in list" :key="row.orderId || row.sequenceNo" class="chain-row">
            <span class="col-seq sequence-no">#{{ row.sequenceNo }}</span>
            <span class="col-name nickname">{{ row.nickname }}</span>
            <span class="col-trade metric-plain">{{ getAssetName(row.assetCode) }}</span>
            <span class="col-gold metric-gold">{{ row.quantityGrams }}g</span>
            <span class="col-time time">{{ row.submittedAt }}</span>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chain-page {
  min-height: 100%;
  padding: 0.7rem 1rem 6.6rem;
  background:
    radial-gradient(circle at 15% 10%, rgba(193, 133, 28, 0.14), transparent 24%),
    radial-gradient(circle at 85% 22%, rgba(191, 148, 63, 0.08), transparent 28%),
    linear-gradient(180deg, #0b1624 0%, #0b1826 42%, #0c1723 100%);
}

.chain-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(207, 215, 224, 0.9);
  cursor: pointer;
  transition: background 0.2s;
  border: none;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.header-kicker {
  margin-bottom: 0.2rem;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(191, 148, 63, 0.8);
}

.title {
  font-size: 1.08rem;
  font-weight: 700;
  color: #f8fbff;
}

.sync-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.2rem;
  font-size: 0.7rem;
  color: rgba(196, 167, 110, 0.86);
  white-space: nowrap;
}

.sync-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.chain-list {
  display: block;
}

.chain-table-wrap {
  overflow-x: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 24, 36, 0.55);
}

.chain-table {
  min-width: 700px;
}

.chain-row {
  display: grid;
  grid-template-columns: 100px 160px 180px 140px 180px;
  align-items: center;
  gap: 0;
  min-height: 52px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.83rem;
  color: #e7edf5;
}

.chain-row > span {
  padding: 0 0.65rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}

.chain-row > span:last-child {
  border-right: none;
}

.chain-head {
  min-height: 44px;
  font-size: 0.74rem;
  color: rgba(149, 167, 188, 0.95);
  background: rgba(16, 27, 40, 0.94);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sequence-no {
  font-size: 0.75rem;
  color: rgba(191, 148, 63, 0.8);
}

.nickname {
  font-weight: 700;
  color: #f8fbff;
}

.time {
  color: rgba(208, 217, 227, 0.68);
}

.metric-plain {
  color: #f3f4f6;
}

.metric-gold {
  color: #f3d27f;
  font-weight: 700;
}

.empty {
  text-align: center;
  color: rgba(207, 215, 224, 0.82);
  font-size: 0.8rem;
  padding: 1.15rem 0.9rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.03);
}

@media (max-width: 640px) {
  .chain-page {
    padding: 0.7rem 0.9rem 6.6rem;
  }
}
</style>