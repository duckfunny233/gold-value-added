<script setup>
import { ref, onMounted } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { UserService } from '../services/user'

defineOptions({ name: 'GoldChain' })

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
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
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
        nickname: item.nickname || `链上用户${index + 1}`,
        buyInfo:
          item.buyInfo ||
          `买入 ${Number(item.buyCount || 0)} 笔 / 卖出 ${Number(item.sellCount || 0)} 笔`,
        goldGrams: Number(item.goldGrams || 0),
        silverGrams: Number(item.silverGrams || 0),
        totalAssets: Number(item.totalAssets || 0),
        updatedAt: item.updatedAt || item.lastTradeAt || '-'
      }))
      return
    }

    list.value = fallbackList
  } catch (error) {
    console.error('金链半公开数据加载失败，使用本地示例数据:', error)
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
        <h1 class="title">金链半公开数据</h1>
      </div>
      <div class="sync-mark">
        <RefreshCw :size="14" class="sync-icon" :class="{ spinning: loading }" />
        <span>{{ loading ? '同步中' : '已更新' }}</span>
      </div>
    </header>

    <section class="chain-list">
      <div v-if="loading" class="empty">正在同步链上摘要...</div>

      <div v-else-if="list.length === 0" class="empty">暂无可展示数据</div>

      <article v-for="row in list" v-else :key="row.sequenceNo" class="chain-card">
        <div class="card-top">
          <div>
            <p class="sequence-no">#{{ row.sequenceNo }}</p>
            <h3 class="nickname">{{ row.nickname }}</h3>
          </div>
          <p class="time">{{ row.updatedAt }}</p>
        </div>

        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-label">买卖数据</span>
            <span class="metric-value plain">{{ row.buyInfo }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">黄金克数</span>
            <span class="metric-value gold">{{ row.goldGrams.toFixed(2) }} g</span>
          </div>
          <div class="metric">
            <span class="metric-label">白银克数</span>
            <span class="metric-value silver">{{ row.silverGrams.toFixed(2) }} g</span>
          </div>
          <div class="metric">
            <span class="metric-label">总资产</span>
            <span class="metric-value asset">{{ formatCurrency(row.totalAssets) }}</span>
          </div>
        </div>
      </article>
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
  display: grid;
  gap: 0.85rem;
}

.chain-card {
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0)),
    linear-gradient(180deg, #102031 0%, #0d1a28 100%);
  padding: 0.95rem;
  box-shadow: 0 16px 32px rgba(3, 9, 18, 0.42);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.sequence-no {
  font-size: 0.7rem;
  color: rgba(191, 148, 63, 0.8);
}

.nickname {
  margin-top: 0.2rem;
  font-size: 1rem;
  font-weight: 700;
  color: #f8fbff;
}

.time {
  font-size: 0.72rem;
  color: rgba(208, 217, 227, 0.68);
  text-align: right;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.metric {
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
}

.metric-label {
  display: block;
  font-size: 0.68rem;
  color: rgba(208, 217, 227, 0.62);
}

.metric-value {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.84rem;
  font-weight: 700;
}

.metric-value.plain {
  color: #f3f4f6;
}

.metric-value.gold {
  color: #f3d27f;
}

.metric-value.silver {
  color: #d7e1ec;
}

.metric-value.asset {
  color: rgba(191, 148, 63, 0.92);
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

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .card-top {
    flex-direction: column;
  }

  .time {
    text-align: left;
  }
}
</style>
