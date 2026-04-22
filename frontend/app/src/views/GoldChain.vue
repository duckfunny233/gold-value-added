<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import { UserService } from '../services/user'

defineOptions({ name: 'GoldChain' })
const { t, locale } = useI18n()

const loading = ref(false)
const list = ref([])

const fallbackList = [
  { sequenceNo: 100001, nickname: '金海逐光', buyInfo: '买入 12 笔 / 卖出 3 笔', goldGrams: 1280.65, silverGrams: 356.2, totalAssets: 998600, updatedAt: '2026-04-05 10:52:10' },
  { sequenceNo: 100002, nickname: '沪上买手', buyInfo: '买入 10 笔 / 卖出 2 笔', goldGrams: 1150.2, silverGrams: 280.5, totalAssets: 892500, updatedAt: '2026-04-05 10:50:40' },
  { sequenceNo: 100003, nickname: '北城风控', buyInfo: '买入 8 笔 / 卖出 1 笔', goldGrams: 972.88, silverGrams: 228.36, totalAssets: 761000, updatedAt: '2026-04-05 10:49:06' },
  { sequenceNo: 100004, nickname: '长安金客', buyInfo: '买入 7 笔 / 卖出 2 笔', goldGrams: 845.42, silverGrams: 176.48, totalAssets: 665900, updatedAt: '2026-04-05 10:48:15' },
  { sequenceNo: 100005, nickname: '晨雾交易员', buyInfo: '买入 6 笔 / 卖出 2 笔', goldGrams: 724.9, silverGrams: 140.33, totalAssets: 571300, updatedAt: '2026-04-05 10:47:34' }
]

function formatCurrency(value) {
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
  const selectedLocale = localeMap[String(locale.value || '').toLowerCase()] || 'en-US'
  return `¥${Number(value || 0).toLocaleString(selectedLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

async function fetchChainData() {
  loading.value = true
  try {
    const result = await UserService.getGoldChainRecords()
    const rows = result?.data?.items || result?.data || []

    if (Array.isArray(rows) && rows.length > 0) {
      list.value = rows.map((item, index) => ({
        sequenceNo: item.sequenceNo || 100000 + index + 1,
        nickname: item.nickname || t('goldChain.userNo', { index: index + 1 }),
        buyInfo:
          item.buyInfo ||
          t('goldChain.tradeInfo', { buy: Number(item.buyCount || 0), sell: Number(item.sellCount || 0) }),
        goldGrams: Number(item.goldGrams || 0),
        silverGrams: Number(item.silverGrams || 0),
        totalAssets: Number(item.totalAssets || 0),
        updatedAt: item.updatedAt || item.lastTradeAt || '-'
      }))
      return
    }

    list.value = fallbackList
  } catch (error) {
    console.error('Gold chain load failed, fallback to local samples:', error)
    list.value = fallbackList
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
            <span class="col-name">{{ t('goldChain.columns.nickname') }}</span>
            <span class="col-trade">{{ t('goldChain.metrics.trade') }}</span>
            <span class="col-gold">{{ t('goldChain.metrics.gold') }}</span>
            <span class="col-silver">{{ t('goldChain.metrics.silver') }}</span>
            <span class="col-asset">{{ t('goldChain.metrics.totalAsset') }}</span>
            <span class="col-time">{{ t('goldChain.columns.time') }}</span>
          </div>

          <article v-for="row in list" :key="row.sequenceNo" class="chain-row">
            <span class="col-seq sequence-no">#{{ row.sequenceNo }}</span>
            <span class="col-name nickname">{{ row.nickname }}</span>
            <span class="col-trade metric-plain">{{ row.buyInfo }}</span>
            <span class="col-gold metric-gold">{{ row.goldGrams.toFixed(2) }} g</span>
            <span class="col-silver metric-silver">{{ row.silverGrams.toFixed(2) }} g</span>
            <span class="col-asset metric-asset">{{ formatCurrency(row.totalAssets) }}</span>
            <span class="col-time time">{{ row.updatedAt }}</span>
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
  min-width: 980px;
}

.chain-row {
  display: grid;
  grid-template-columns: 120px 160px 180px 130px 130px 160px 170px;
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

.metric-silver {
  color: #d7e1ec;
  font-weight: 700;
}

.metric-asset {
  color: rgba(191, 148, 63, 0.92);
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
