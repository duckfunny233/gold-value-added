<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import { UserService } from '../services/user'
import { showToast } from '../composables/useToast'

defineOptions({ name: 'GoldChain' })
const { t } = useI18n()

const loading = ref(false)
const list = ref([])

const shortText = (value, max = 24) => {
  const raw = String(value || '')
  if (raw.length <= max) return raw
  return `${raw.slice(0, max)}...`
}

async function fetchChainData() {
  loading.value = true
  try {
    const result = await UserService.getGoldChainRecords()
    const rows = result?.data?.items || result?.data || []

    list.value = Array.isArray(rows)
      ? rows.map((item, index) => ({
          sequenceNo: item.sequenceNo || 100000 + index + 1,
          traceId: String(item.traceId || '-'),
          hashValue: String(item.hashValue || '-'),
          chainSyncStatus: String(item.chainSyncStatus || item.syncStatus || '-'),
          createdAt: String(item.createdAt || item.updatedAt || '-'),
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

onMounted(fetchChainData)
</script>

<template>
  <div class="chain-page">
    <header class="chain-header">
      <div>
        <p class="header-kicker">CHAIN BOARD</p>
        <h1 class="title">{{ t('goldChain.title') }}</h1>
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
            <span class="col-name">Trace ID</span>
            <span class="col-trade">Hash</span>
            <span class="col-gold">同步状态</span>
            <span class="col-time">{{ t('goldChain.columns.time') }}</span>
          </div>

          <article v-for="row in list" :key="row.sequenceNo" class="chain-row">
            <span class="col-seq sequence-no">#{{ row.sequenceNo }}</span>
            <span class="col-name nickname" :title="row.traceId">{{ shortText(row.traceId, 22) }}</span>
            <span class="col-trade metric-plain" :title="row.hashValue">{{ shortText(row.hashValue, 26) }}</span>
            <span class="col-gold metric-gold">{{ row.chainSyncStatus }}</span>
            <span class="col-time time">{{ row.createdAt }}</span>
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
  min-width: 860px;
}

.chain-row {
  display: grid;
  grid-template-columns: 110px 240px 300px 130px 180px;
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
