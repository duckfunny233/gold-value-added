<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import ActionDialog from '../components/ActionDialog.vue'
import { PlatformService } from '../services/platform'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const actionMessage = ref('')

const funds = reactive({
  totalRecharge: 0,
  totalWithdraw: 0,
  platformBalance: 0,
  frozenAmount: 0,
})

const userAssets = reactive({
  totalUsers: 0,
  totalHoldingValue: 0,
  totalAvailableBalance: 0,
})

const fundPool = reactive({
  liquidityRatio: 0,
  riskReserveRatio: 0,
  status: 'normal',
})

const channels = ref([])
const alerts = ref([])

const flowTrend = reactive({
  labels: [],
  rechargeData: [],
  withdrawData: [],
})

const alertDialog = reactive({
  open: false,
  largeRechargeThreshold: 100000,
  largeWithdrawThreshold: 100000,
  rapidChangePercent: 20,
})

const svgWidth = 600
const svgHeight = 200
const padding = { top: 10, right: 10, bottom: 30, left: 50 }

const chartWidth = svgWidth - padding.left - padding.right
const chartHeight = svgHeight - padding.top - padding.bottom

const flowPath = reactive({
  rechargePath: '',
  withdrawPath: '',
  xLabels: [],
  yMax: 0,
})

function formatCurrency(value) {
  if (value == null) return '-'
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(value) {
  if (value == null) return '-'
  return Number(value).toFixed(2) + '%'
}

function buildLinePath(data, maxValue) {
  if (!data.length) return ''
  const stepX = chartWidth / Math.max(data.length - 1, 1)
  return data
    .map((val, i) => {
      const x = padding.left + i * stepX
      const y = padding.top + chartHeight - (maxValue ? (val / maxValue) * chartHeight : 0)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function buildChart() {
  const allValues = [...flowTrend.rechargeData, ...flowTrend.withdrawData]
  const maxValue = allValues.length ? Math.max(...allValues) * 1.1 : 1
  flowPath.rechargePath = buildLinePath(flowTrend.rechargeData, maxValue)
  flowPath.withdrawPath = buildLinePath(flowTrend.withdrawData, maxValue)
  flowPath.yMax = maxValue
  flowPath.xLabels = flowTrend.labels.map((label, i) => {
    const stepX = chartWidth / Math.max(flowTrend.labels.length - 1, 1)
    return {
      label,
      x: padding.left + i * stepX,
    }
  })
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const fundsData = await PlatformService.getPlatformFunds()
    Object.assign(funds, fundsData)

    const userData = await PlatformService.getUserAssetsSummary()
    Object.assign(userAssets, userData)

    const poolData = await PlatformService.getFundPoolHealth()
    Object.assign(fundPool, poolData)

    const channelData = await PlatformService.getChannelDistribution()
    channels.value = channelData.channels || []

    const alertData = await PlatformService.getAbnormalAlerts()
    alerts.value = alertData.alerts || []

    const trendData = await PlatformService.getFundFlowTrend()
    flowTrend.labels = trendData.labels || []
    flowTrend.rechargeData = trendData.rechargeData || []
    flowTrend.withdrawData = trendData.withdrawData || []
    buildChart()
  } catch (err) {
    error.value = err.message || '资金数据加载失败'
  } finally {
    loading.value = false
  }
}

function openAlertDialog() {
  alertDialog.open = true
}

async function saveAlertThreshold() {
  saving.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await PlatformService.updateAlertThreshold({
      largeRechargeThreshold: alertDialog.largeRechargeThreshold,
      largeWithdrawThreshold: alertDialog.largeWithdrawThreshold,
      rapidChangePercent: alertDialog.rapidChangePercent,
    })
    actionMessage.value = '预警阈值已更新'
    alertDialog.open = false
  } catch (err) {
    error.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="平台资金总览" description="实时监控平台资金状况、用户资产分布及资金池健康度。" />

  <section class="panel">
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '刷新中...' : '刷新数据' }}</button>
      <button @click="openAlertDialog">预警设置</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="stats-grid">
    <div class="stat-card">
      <h3>总充值金额</h3>
      <p class="stat-value">{{ formatCurrency(funds.totalRecharge) }}</p>
    </div>
    <div class="stat-card">
      <h3>总提现金额</h3>
      <p class="stat-value">{{ formatCurrency(funds.totalWithdraw) }}</p>
    </div>
    <div class="stat-card">
      <h3>平台当前余额</h3>
      <p class="stat-value">{{ formatCurrency(funds.platformBalance) }}</p>
    </div>
    <div class="stat-card">
      <h3>冻结金额</h3>
      <p class="stat-value">{{ formatCurrency(funds.frozenAmount) }}</p>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>实时资金流动趋势</h2>
      <span class="muted">今日充值与提现趋势对比</span>
    </div>
    <div class="chart-wrap">
      <svg :width="svgWidth" :height="svgHeight" viewBox="0 0 600 200">
        <line :x1="padding.left" :y1="padding.top + chartHeight" :x2="padding.left + chartWidth" :y2="padding.top + chartHeight" stroke="#e5e7eb" stroke-width="1" />
        <line :x1="padding.left" :y1="padding.top" :x2="padding.left" :y2="padding.top + chartHeight" stroke="#e5e7eb" stroke-width="1" />

        <text v-for="(item, i) in [0, 0.25, 0.5, 0.75, 1]" :key="'y' + i" :x="padding.left - 6" :y="padding.top + chartHeight - item * chartHeight + 4" text-anchor="end" font-size="10" fill="#9ca3af">
          {{ formatCurrency(flowPath.yMax * item).replace('¥', '') }}
        </text>

        <text v-for="label in flowPath.xLabels" :key="label.label" :x="label.x" :y="svgHeight - 4" text-anchor="middle" font-size="10" fill="#9ca3af">
          {{ label.label }}
        </text>

        <path v-if="flowPath.rechargePath" :d="flowPath.rechargePath" fill="none" stroke="#10b981" stroke-width="2" />
        <path v-if="flowPath.withdrawPath" :d="flowPath.withdrawPath" fill="none" stroke="#ef4444" stroke-width="2" />
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background:#10b981"></span>充值</span>
        <span class="legend-item"><span class="legend-dot" style="background:#ef4444"></span>提现</span>
      </div>
    </div>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>用户资产汇总</h2>
        <span class="muted">平台用户资产整体情况</span>
      </div>
      <div class="kv-list">
        <div class="kv-item"><strong>总用户数</strong><span>{{ userAssets.totalUsers != null ? userAssets.totalUsers.toLocaleString() : '-' }}</span></div>
        <div class="kv-item"><strong>总持仓市值</strong><span>{{ formatCurrency(userAssets.totalHoldingValue) }}</span></div>
        <div class="kv-item"><strong>总可用余额</strong><span>{{ formatCurrency(userAssets.totalAvailableBalance) }}</span></div>
      </div>
    </article>

    <aside class="panel">
      <div class="panel-head">
        <h2>资金池健康度</h2>
        <span class="muted">流动性与风险准备金指标</span>
      </div>
      <div class="kv-list">
        <div class="kv-item"><strong>流动性比率</strong><span>{{ formatPercent(fundPool.liquidityRatio) }}</span></div>
        <div class="kv-item"><strong>风险准备金比例</strong><span>{{ formatPercent(fundPool.riskReserveRatio) }}</span></div>
        <div class="kv-item"><strong>健康状态</strong>
          <span :class="fundPool.status === 'normal' ? 'badge-success' : fundPool.status === 'warning' ? 'badge-warn' : 'badge-danger'">
            {{ fundPool.status === 'normal' ? '健康' : fundPool.status === 'warning' ? '预警' : '危险' }}
          </span>
        </div>
      </div>
    </aside>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>渠道资金分布</h2>
        <span class="muted">各支付渠道余额占比</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>渠道</th>
            <th>余额</th>
            <th>占比</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ch in channels" :key="ch.name">
            <td>{{ ch.name }}</td>
            <td>{{ formatCurrency(ch.balance) }}</td>
            <td>{{ formatPercent(ch.ratio) }}</td>
          </tr>
          <tr v-if="!channels.length">
            <td colspan="3" class="table-empty">暂无渠道数据</td>
          </tr>
        </tbody>
      </table>
    </article>

    <aside class="panel">
      <div class="panel-head">
        <h2>异常资金预警</h2>
        <span class="muted">近期大额异动提醒</span>
      </div>
      <ul class="list-plain">
        <li v-for="alert in alerts" :key="alert.id" class="alert-item">
          <span :class="alert.type === 'recharge' ? 'badge-success' : 'badge-danger'">{{ alert.type === 'recharge' ? '大额充值' : '大额提现' }}</span>
          <span>{{ formatCurrency(alert.amount) }}</span>
          <span class="muted">{{ alert.time }}</span>
        </li>
        <li v-if="!alerts.length" class="muted">暂无异常预警</li>
      </ul>
    </aside>
  </section>

  <ActionDialog
    :open="alertDialog.open"
    title="异常资金预警设置"
    description="设置大额异动提醒阈值"
    confirm-text="保存"
    :loading="saving"
    @close="alertDialog.open = false"
    @confirm="saveAlertThreshold"
  >
    <div class="dialog-form">
      <label>
        大额充值阈值 (元)
        <input v-model.number="alertDialog.largeRechargeThreshold" type="number" min="0" step="1000" />
      </label>
      <label>
        大额提现阈值 (元)
        <input v-model.number="alertDialog.largeWithdrawThreshold" type="number" min="0" step="1000" />
      </label>
      <label>
        资金快速变动百分比 (%)
        <input v-model.number="alertDialog.rapidChangePercent" type="number" min="0" max="100" step="1" />
      </label>
    </div>
  </ActionDialog>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--panel-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 16px;
}
.stat-card h3 {
  font-size: 13px;
  color: var(--text-muted, #6b7280);
  margin-bottom: 8px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}
.chart-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.chart-legend {
  display: flex;
  gap: 16px;
  font-size: 13px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
}
.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
  font-size: 14px;
}
.alert-item:last-child {
  border-bottom: none;
}
.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.dialog-form input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
</style>
