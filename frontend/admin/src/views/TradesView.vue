<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  tradeNo: '',
  tradeType: '',
  uid: '',
  status: '',
  syncStatus: '',
  timeRange: 'today',
})

useQueryFilters(filters, ['tradeNo', 'tradeType', 'uid', 'status', 'syncStatus', 'timeRange'])

const stats = ref([])
const trades = ref([])
const controlItems = ref([])
const monitorCards = ref([])
const sessions = ref([])
const syncOverview = ref({})
const selectedTradeNo = ref('')
const loading = ref(false)
const error = ref('')
const actionMessage = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getTrades(filters)
    stats.value = data.stats || []
    trades.value = data.trades || []
    controlItems.value = data.controlItems || []
    monitorCards.value = data.monitorCards || []
    sessions.value = data.sessions || []
    syncOverview.value = data.syncOverview || {}
    selectedTradeNo.value = trades.value[0]?.tradeNo || ''
  } catch (err) {
    error.value = err.message || '交易数据加载失败'
  } finally {
    loading.value = false
  }
}

function getSelectedTrade() {
  return trades.value.find((item) => item.tradeNo === selectedTradeNo.value) || null
}

async function runAction(handler, successMessage) {
  error.value = ''
  actionMessage.value = ''
  try {
    await handler()
    actionMessage.value = successMessage
    await loadData()
  } catch (err) {
    error.value = err.message || '交易操作失败'
  }
}

async function handlePauseTrading() {
  await runAction(() => AdminService.pauseTrading(), '全站停盘已执行')
}

async function handleResumeTrading() {
  await runAction(() => AdminService.resumeTrading(), '交易已恢复')
}

async function handleRetrySync() {
  const selected = getSelectedTrade()
  await runAction(
    () => AdminService.retryTradeSync(selected ? { tradeNo: selected.tradeNo } : {}),
    selected ? `已重试交易 ${selected.tradeNo} 的同步` : '已重试全部待同步交易',
  )
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="交易管理" description="完成买卖交易全流程管控、撮合监控与上金所交易时段同步状态查看。" />

  <section class="panel">
    <div class="form-row">
      <label>交易号<input v-model="filters.tradeNo" placeholder="请输入交易号" /></label>
      <label>
        交易类型
        <select v-model="filters.tradeType">
          <option value="">全部</option>
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>
      </label>
      <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
      <label>
        交易状态
        <select v-model="filters.status">
          <option value="">全部</option>
          <option value="success">成功</option>
          <option value="processing">处理中</option>
          <option value="failed">失败</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="loadData" :disabled="loading">刷新状态</button>
      <button class="warn" @click="handlePauseTrading">全站停盘</button>
      <button @click="handleResumeTrading">恢复交易</button>
      <button @click="handleRetrySync">重试同步</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="grid-4">
    <article class="stat-card" v-for="card in stats" :key="card.label">
      <p class="stat-label">{{ card.label }}</p>
      <p class="stat-value">{{ card.value }}</p>
      <p class="note">{{ card.note }}</p>
    </article>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>交易列表</h2>
        <span class="muted">覆盖买单和卖单，支持同步状态查看</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>交易号</th>
            <th>交易类型</th>
            <th>用户UID</th>
            <th>昵称</th>
            <th>金额</th>
            <th>克数</th>
            <th>状态</th>
            <th>同步状态</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in trades"
            :key="row.tradeNo"
            @click="selectedTradeNo = row.tradeNo"
            :class="{ 'is-selected': selectedTradeNo === row.tradeNo }"
          >
            <td>{{ row.tradeNo }}</td>
            <td>{{ row.tradeType }}</td>
            <td>{{ row.uid }}</td>
            <td>{{ row.nickname }}</td>
            <td>{{ row.amount }}</td>
            <td>{{ row.grams }}</td>
            <td>{{ row.status }}</td>
            <td>{{ row.syncStatus }}</td>
            <td>{{ row.createdAt }}</td>
          </tr>
        </tbody>
      </table>
    </article>

    <aside class="stack">
      <article class="panel">
        <div class="panel-head">
          <h2>撮合与同步控制</h2>
          <span class="muted">固定写入代码的交易控制规则</span>
        </div>
        <div class="kv-list">
          <div class="kv-item" v-for="item in monitorCards" :key="item.key">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </div>
        </div>
        <ul class="list-plain">
          <li v-for="item in controlItems" :key="item">{{ item }}</li>
        </ul>
      </article>
    </aside>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>上金所时段同步状态</h2>
      <span class="muted">只读展示自动同步结果，不提供手动配置入口</span>
    </div>
    <div class="grid-4">
      <article class="stat-card">
        <p class="stat-label">同步来源</p>
        <p class="stat-value">{{ syncOverview.source || '上金所交易时段自动同步' }}</p>
        <p class="note">{{ syncOverview.note || '当前仅展示只读状态' }}</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">同步状态</p>
        <p class="stat-value">{{ syncOverview.syncStatus || '安全降级' }}</p>
        <p class="note">刷新时间 {{ syncOverview.lastRefreshAt || '--' }}</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">当前时段</p>
        <p class="stat-value">{{ syncOverview.currentSession || '暂无可用交易时段' }}</p>
        <p class="note">仅展示同步后的时段信息</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">下一开盘时间</p>
        <p class="stat-value">{{ syncOverview.nextOpenTime || '待同步' }}</p>
        <p class="note">交易关闭时用户端将自动禁用买卖提交</p>
      </article>
    </div>
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>交易时段</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in sessions" :key="`${item.day}-${item.session}`">
          <td>{{ item.day }}</td>
          <td>{{ item.session }}</td>
          <td>{{ item.status }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
