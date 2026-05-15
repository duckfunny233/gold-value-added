<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
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
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')
const tradingStatus = ref('normal')

const systemDialog = reactive({
  open: false,
  action: 'pause',
  reason: '',
})

const systemDialogTitle = computed(() => (systemDialog.action === 'pause' ? '全站停盘' : '恢复交易'))

const statusBadgeClass = computed(() => {
  return tradingStatus.value === 'paused' ? 'badge-danger' : 'badge-success'
})

const statusText = computed(() => {
  return tradingStatus.value === 'paused' ? '停盘中' : '交易正常'
})

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
    tradingStatus.value = data.tradingStatus || 'normal'
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

function openSystemDialog(action) {
  systemDialog.action = action
  systemDialog.reason = ''
  systemDialog.open = true
}

async function submitSystemDialog() {
  dialogLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    if (systemDialog.action === 'pause') {
      await AdminService.pauseTrading()
      actionMessage.value = systemDialog.reason
        ? `全站已停盘，原因：${systemDialog.reason}`
        : '全站已停盘'
      tradingStatus.value = 'paused'
    } else {
      await AdminService.resumeTrading()
      actionMessage.value = '交易已恢复正常'
      tradingStatus.value = 'normal'
    }
  } catch (err) {
    error.value = err.message || '操作失败'
  } finally {
    dialogLoading.value = false
    systemDialog.open = false
  }
}

async function handleGenerateReport() {
  dialogLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await AdminService.generateReport({
      reportType: 'finance',
      timeRange: filters.timeRange,
      uid: filters.uid,
      format: 'csv',
      name: '交易流水导出',
    })
    actionMessage.value = '报表任务已生成，请前往报表中心下载'
  } catch (err) {
    error.value = err.message || '生成报表任务失败'
  } finally {
    dialogLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="交易管理" />

  <section class="panel">
    <div class="status-bar">
      <span class="status-label">当前交易状态：</span>
      <span class="badge" :class="statusBadgeClass">{{ statusText }}</span>
    </div>
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
      <button class="warn" @click="openSystemDialog('pause')" :disabled="tradingStatus === 'paused'">全站停盘</button>
      <button @click="openSystemDialog('resume')" :disabled="tradingStatus === 'normal'">恢复交易</button>
      <button @click="handleGenerateReport" :disabled="loading">生成报表</button>
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

  <section class="panel">
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
        <tr v-if="!trades.length">
          <td colspan="9" class="table-empty">暂无交易记录</td>
        </tr>
      </tbody>
    </table>
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
        <tr v-if="!sessions.length">
          <td colspan="3" class="table-empty">暂无时段数据</td>
        </tr>
      </tbody>
    </table>
  </section>

  <ActionDialog
    :open="systemDialog.open"
    :title="systemDialogTitle"
    :description="systemDialog.action === 'pause' ? '停盘后所有用户将无法提交买卖订单。' : '恢复交易后用户可正常提交买卖订单。'"
    :confirm-text="systemDialog.action === 'pause' ? '确认停盘' : '确认恢复'"
    :loading="dialogLoading"
    :danger="systemDialog.action === 'pause'"
    @close="systemDialog.open = false"
    @confirm="submitSystemDialog"
  >
    <label v-if="systemDialog.action === 'pause'" class="dialog-label">
      停盘原因
      <textarea v-model="systemDialog.reason" rows="3" placeholder="请输入停盘原因（会记录到操作日志）"></textarea>
    </label>
    <p v-else class="dialog-tip">确认恢复全站交易？</p>
  </ActionDialog>
</template>

<style scoped>
.dialog-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.dialog-label textarea {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
}
</style>
