<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'
import { PlatformService } from '../services/platform'
import {
  getWithdrawAlertStatusLabel,
  getWithdrawStatusLabel,
  WITHDRAW_STATUS,
} from '../../../shared/constants/status'

const activeMainTab = ref('orders')

const filters = reactive({
  orderType: '',
  uid: '',
  channel: '',
  status: '',
  timeRange: 'today',
})

const activeSubTab = ref('recharge')
const summaryCards = ref([])
const rechargeRows = ref([])
const withdrawRows = ref([])
const ledgerRows = ref([])
const reconcileItems = ref([])
const selectedWithdrawalId = ref('')
const loading = ref(false)
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')

const fundDialog = reactive({
  open: false,
  mode: 'transfer',
  uid: '',
  amount: '100',
  direction: 'increase',
  reason: '',
})

const rechargeDetailDialog = reactive({
  open: false,
  row: {},
})

const withdrawDetail = reactive({
  open: false,
  row: {},
})

const rejectDialog = reactive({
  open: false,
  orderId: '',
  reason: '',
})

const selectedWithdrawIds = ref([])

useQueryFilters(filters, ['orderType', 'uid', 'channel', 'status', 'timeRange'])

const rechargeStats = computed(() => {
  const todayTotal = rechargeRows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const pendingCount = rechargeRows.value.filter((r) => r.status === '对账中').length
  return [
    { label: '今日充值总额', value: '¥' + todayTotal.toFixed(2), note: '当前筛选范围内' },
    { label: '待对账笔数', value: pendingCount + ' 笔', note: '状态为对账中' },
  ]
})

const withdrawStats = computed(() => {
  const pendingCount = withdrawRows.value.filter((r) => r.status === WITHDRAW_STATUS.PENDING_REVIEW).length
  const todayTotal = withdrawRows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const processingAmount = withdrawRows.value
    .filter((r) => r.status === WITHDRAW_STATUS.TRANSFER_PROCESSING)
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  return [
    { label: '待审核笔数', value: pendingCount + ' 笔', note: '需尽快处理' },
    { label: '今日提现总额', value: '¥' + todayTotal.toFixed(2), note: '当前筛选范围内' },
    { label: '审核中金额', value: '¥' + processingAmount.toFixed(2), note: '转账处理中' },
  ]
})

const currentStats = computed(() => {
  if (activeSubTab.value === 'recharge') return rechargeStats.value
  return withdrawStats.value
})

const filteredWithdrawRows = computed(() => {
  if (!filters.channel) return withdrawRows.value
  return withdrawRows.value.filter((r) => r.channel === filters.channel)
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getFunds(filters)
    summaryCards.value = data.summaryCards || []
    rechargeRows.value = data.rechargeRows || []
    withdrawRows.value = data.withdrawRows || []
    ledgerRows.value = data.ledgerRows || []
    reconcileItems.value = data.reconcileItems || []
    selectedWithdrawalId.value = withdrawRows.value[0]?.orderId || ''
    selectedWithdrawIds.value = []
  } catch (err) {
    error.value = err.message || '资金数据加载失败'
  } finally {
    loading.value = false
  }
}

function getSelectedWithdrawal() {
  return withdrawRows.value.find((item) => item.orderId === selectedWithdrawalId.value) || null
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

async function runAction(handler, successMessage) {
  error.value = ''
  actionMessage.value = ''
  dialogLoading.value = true
  try {
    await handler()
    actionMessage.value = successMessage
    await loadData()
  } catch (err) {
    error.value = err.message || '资金操作失败'
  } finally {
    dialogLoading.value = false
  }
}

async function handleExport() {
  await runAction(async () => {
    const job = await AdminService.generateReport({
      reportType: 'finance',
      timeRange: filters.timeRange,
      uid: filters.uid,
      channel: filters.channel,
      format: 'csv',
      name: '资金数据导出',
    })
    await AdminService.exportReportJob(job.jobId, { format: 'csv' })
  }, '已通过报表任务导出资金数据')
}

function openFundDialog(mode) {
  fundDialog.mode = mode
  fundDialog.uid = filters.uid || ''
  fundDialog.amount = '100'
  fundDialog.direction = mode === 'adjust' ? 'decrease' : 'increase'
  fundDialog.reason =
    mode === 'transfer'
      ? '后台手工转账'
      : mode === 'topup'
        ? '异常补款处理'
        : '后台资产调整'
  fundDialog.open = true
}

async function submitFundDialog() {
  const uid = fundDialog.uid.trim()
  const reason = fundDialog.reason.trim()
  const amount = Number(fundDialog.amount)

  if (!uid || !reason || !amount || amount <= 0) {
    error.value = '请完整填写用户 UID、金额和原因'
    return
  }

  if (fundDialog.mode === 'transfer') {
    const key = `manual-transfer-${Date.now()}`
    await runAction(
      () =>
        AdminService.manualTransfer(
          { uid, amount, direction: fundDialog.direction, reason, clientRequestId: key },
          key,
        ),
      '手工转账已完成',
    )
  } else {
    const key = `${fundDialog.mode === 'topup' ? 'manual-adjust-topup' : 'manual-adjust'}-${Date.now()}`
    await runAction(
      () =>
        AdminService.manualAdjust(
          {
            uid,
            amount,
            direction: fundDialog.mode === 'topup' ? 'increase' : fundDialog.direction,
            reason,
            clientRequestId: key,
          },
          key,
        ),
      fundDialog.mode === 'topup' ? '补款处理已完成' : '资产调整已完成',
    )
  }

  fundDialog.open = false
}

function openRechargeDetail(row) {
  rechargeDetailDialog.row = row
  rechargeDetailDialog.open = true
}

async function handleReconcile(row, status) {
  await runAction(
    () => AdminService.updateRechargeStatus(row.orderId, status),
    `订单 ${row.orderId} 已标记为${status === 'reconciled' ? '已对账' : '异常'}`,
  )
}

function openWithdrawDetail(row) {
  withdrawDetail.row = row
  withdrawDetail.open = true
}

async function handleApproveWithdrawal(orderId) {
  await runAction(
    () => AdminService.approveWithdrawal(orderId),
    `提现订单 ${orderId} 已通过审核`,
  )
}

function openRejectDialog(orderId) {
  rejectDialog.orderId = orderId
  rejectDialog.reason = ''
  rejectDialog.open = true
}

async function submitRejectDialog() {
  if (!rejectDialog.reason.trim()) {
    error.value = '请填写拒绝原因'
    return
  }
  await runAction(
    () => AdminService.rejectWithdrawal(rejectDialog.orderId, rejectDialog.reason),
    `提现订单 ${rejectDialog.orderId} 已拒绝`,
  )
  rejectDialog.open = false
}

async function handleConfirmCompleted(orderId) {
  await runAction(
    () => AdminService.confirmWithdrawalCompleted(orderId),
    `提现订单 ${orderId} 已标记转账完成`,
  )
}

async function handleMuteAlert(orderId) {
  await runAction(
    () => AdminService.muteWithdrawalAlert(orderId),
    `提现订单 ${orderId} 提醒已静音`,
  )
}

function toggleSelectWithdraw(orderId) {
  const index = selectedWithdrawIds.value.indexOf(orderId)
  if (index >= 0) {
    selectedWithdrawIds.value.splice(index, 1)
  } else {
    selectedWithdrawIds.value.push(orderId)
  }
}

function selectAllWithdraw() {
  const ids = filteredWithdrawRows.value.map((r) => r.orderId)
  const allSelected = ids.every((id) => selectedWithdrawIds.value.includes(id))
  if (allSelected) {
    selectedWithdrawIds.value = selectedWithdrawIds.value.filter((id) => !ids.includes(id))
  } else {
    ids.forEach((id) => {
      if (!selectedWithdrawIds.value.includes(id)) {
        selectedWithdrawIds.value.push(id)
      }
    })
  }
}

async function batchApprove() {
  if (!selectedWithdrawIds.value.length) {
    error.value = '请先选择要审核的订单'
    return
  }
  dialogLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await Promise.all(selectedWithdrawIds.value.map((id) => AdminService.approveWithdrawal(id)))
    actionMessage.value = `批量通过完成，共 ${selectedWithdrawIds.value.length} 笔`
    selectedWithdrawIds.value = []
    await loadData()
  } catch (err) {
    error.value = err.message || '批量审核失败'
  } finally {
    dialogLoading.value = false
  }
}

async function batchReject() {
  if (!selectedWithdrawIds.value.length) {
    error.value = '请先选择要审核的订单'
    return
  }
  dialogLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await Promise.all(selectedWithdrawIds.value.map((id) => AdminService.rejectWithdrawal(id, '批量拒绝')))
    actionMessage.value = `批量拒绝完成，共 ${selectedWithdrawIds.value.length} 笔`
    selectedWithdrawIds.value = []
    await loadData()
  } catch (err) {
    error.value = err.message || '批量审核失败'
  } finally {
    dialogLoading.value = false
  }
}

// ========== 平台总览 ==========

const platformLoading = ref(false)
const platformLoaded = ref(false)
const saving = ref(false)

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

async function loadPlatformData() {
  platformLoading.value = true
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

    platformLoaded.value = true
  } catch (err) {
    error.value = err.message || '平台资金数据加载失败'
  } finally {
    platformLoading.value = false
  }
}

function switchToMainTab(tab) {
  activeMainTab.value = tab
  error.value = ''
  actionMessage.value = ''
  if (tab === 'overview' && !platformLoaded.value) {
    loadPlatformData()
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
  <PageHeader title="资金管理" />

  <section class="panel">
    <div class="tabs">
      <button class="tab-btn" :class="{ active: activeMainTab === 'orders' }" @click="switchToMainTab('orders')">订单操作</button>
      <button class="tab-btn" :class="{ active: activeMainTab === 'overview' }" @click="switchToMainTab('overview')">平台总览</button>
    </div>
  </section>

  <!-- ========== 订单操作 ========== -->
  <template v-if="activeMainTab === 'orders'">
    <section class="panel">
      <div class="form-row">
        <label>
          订单类型
          <select v-model="filters.orderType">
            <option value="">全部</option>
            <option value="recharge">充值订单</option>
            <option value="withdraw">提现订单</option>
          </select>
        </label>
        <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
        <label>
          支付渠道
          <select v-model="filters.channel">
            <option value="">全部</option>
            <option value="wechat">微信</option>
            <option value="alipay">支付宝</option>
            <option value="bank">银行卡</option>
          </select>
        </label>
        <label>
          订单状态
          <select v-model="filters.status">
            <option value="">全部</option>
            <option value="reconciling">对账中</option>
            <option value="reconciled">已对账</option>
            <option :value="WITHDRAW_STATUS.PENDING_REVIEW">待审核</option>
            <option :value="WITHDRAW_STATUS.TRANSFER_PROCESSING">转账处理中</option>
            <option :value="WITHDRAW_STATUS.COMPLETED">已完成</option>
            <option :value="WITHDRAW_STATUS.REJECTED">已拒绝</option>
          </select>
        </label>
      </div>
      <div class="actions">
        <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
        <button @click="handleExport">导出</button>
      </div>
      <p v-if="error" class="login-error">{{ error }}</p>
      <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
    </section>

    <section class="grid-4">
      <article class="stat-card" v-for="card in summaryCards" :key="card.label">
        <p class="stat-label">{{ card.label }}</p>
        <p class="stat-value">{{ card.value }}</p>
        <p class="note">{{ card.note }}</p>
      </article>
    </section>

    <section class="grid-4" v-if="activeSubTab === 'recharge'">
      <article class="stat-card" v-for="card in rechargeStats" :key="card.label">
        <p class="stat-label">{{ card.label }}</p>
        <p class="stat-value">{{ card.value }}</p>
        <p class="note">{{ card.note }}</p>
      </article>
    </section>

    <section class="grid-4" v-if="activeSubTab === 'withdraw'">
      <article class="stat-card" v-for="card in withdrawStats" :key="card.label">
        <p class="stat-label">{{ card.label }}</p>
        <p class="stat-value">{{ card.value }}</p>
        <p class="note">{{ card.note }}</p>
      </article>
    </section>

    <section class="split-main-aside">
      <article class="panel">
        <div class="tabs">
          <button class="tab-btn" :class="{ active: activeSubTab === 'recharge' }" @click="activeSubTab = 'recharge'">充值订单</button>
          <button class="tab-btn" :class="{ active: activeSubTab === 'withdraw' }" @click="activeSubTab = 'withdraw'">提现订单</button>
        </div>

        <div v-if="activeSubTab === 'recharge'">
          <div class="panel-head">
            <h2>充值对账查看</h2>
            <span class="muted">24 小时自动到账，无人工审核按钮</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户UID</th>
                <th>昵称</th>
                <th>手机号</th>
                <th>支付渠道</th>
                <th>金额</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rechargeRows" :key="row.orderId">
                <td>{{ row.orderId }}</td>
                <td>{{ row.uid }}</td>
                <td>{{ row.nickname }}</td>
                <td>{{ maskPhone(row.phone) }}</td>
                <td>{{ row.channel }}</td>
                <td>{{ row.amount }}</td>
                <td>{{ row.status }}</td>
                <td>{{ row.createdAt }}</td>
                <td>
                  <div class="cell-actions">
                    <button class="primary" type="button" @click="openRechargeDetail(row)">详情</button>
                    <button v-if="row.status === '对账中'" type="button" @click="handleReconcile(row, 'reconciled')">对账</button>
                    <button v-if="row.status === '对账中'" class="warn" type="button" @click="handleReconcile(row, 'abnormal')">异常</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!rechargeRows.length">
                <td colspan="9" class="table-empty">暂无充值订单</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else>
          <div class="panel-head">
            <h2>提现审核队列</h2>
            <span class="muted">按提交时间顺序排队，需展示收款信息</span>
          </div>
          <div class="form-row" v-if="selectedWithdrawIds.length">
            <span class="muted">已选择 {{ selectedWithdrawIds.length }} 笔</span>
            <div class="actions compact">
              <button class="primary" @click="batchApprove" :disabled="dialogLoading">批量通过</button>
              <button class="warn" @click="batchReject" :disabled="dialogLoading">批量拒绝</button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" @change="selectAllWithdraw" /></th>
                <th>订单号</th>
                <th>用户UID</th>
                <th>昵称</th>
                <th>支付渠道</th>
                <th>金额</th>
                <th>审核状态</th>
                <th>提醒状态</th>
                <th>收款信息</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredWithdrawRows"
                :key="row.orderId"
                @click="selectedWithdrawalId = row.orderId"
                :class="{ 'is-selected': selectedWithdrawalId === row.orderId }"
              >
                <td @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedWithdrawIds.includes(row.orderId)"
                    @change="toggleSelectWithdraw(row.orderId)"
                  />
                </td>
                <td>{{ row.orderId }}</td>
                <td>{{ row.uid }}</td>
                <td>{{ row.nickname }}</td>
                <td>{{ row.channel }}</td>
                <td>{{ row.amount }}</td>
                <td>{{ getWithdrawStatusLabel(row.status) }}</td>
                <td>{{ getWithdrawAlertStatusLabel(row.alertStatus) }}</td>
                <td>{{ row.payout }}</td>
                <td>
                  <div class="cell-actions">
                    <button class="primary" type="button" @click.stop="openWithdrawDetail(row)">详情</button>
                    <button
                      v-if="row.status === WITHDRAW_STATUS.PENDING_REVIEW"
                      type="button"
                      @click.stop="handleApproveWithdrawal(row.orderId)"
                    >
                      通过
                    </button>
                    <button
                      v-if="row.status === WITHDRAW_STATUS.PENDING_REVIEW"
                      class="warn"
                      type="button"
                      @click.stop="openRejectDialog(row.orderId)"
                    >
                      拒绝
                    </button>
                    <button
                      v-if="row.status === WITHDRAW_STATUS.TRANSFER_PROCESSING"
                      type="button"
                      @click.stop="handleConfirmCompleted(row.orderId)"
                    >
                      完成
                    </button>
                    <button
                      v-if="row.alertStatus !== 'muted'"
                      type="button"
                      @click.stop="handleMuteAlert(row.orderId)"
                    >
                      静音
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filteredWithdrawRows.length">
                <td colspan="10" class="table-empty">暂无提现订单</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <aside class="stack">
        <article class="panel">
          <div class="panel-head">
            <h2>补款与资产调整</h2>
            <span class="muted">变更必须写入审计日志</span>
          </div>
          <div class="kv-list">
            <div class="kv-item"><strong>手工转账</strong><span>对用户进行手工转账，实时到账/减账</span></div>
            <div class="kv-item"><strong>补款处理</strong><span>异常补款处理，要求记录追踪号</span></div>
            <div class="kv-item"><strong>资产调整</strong><span>手工资产调整，需保留操作人和原因</span></div>
          </div>
          <div class="actions">
            <button class="primary" @click="openFundDialog('transfer')">手工转账</button>
            <button @click="openFundDialog('topup')">补款处理</button>
            <button @click="openFundDialog('adjust')">资产调整</button>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <h2>渠道对账</h2>
            <span class="muted">覆盖微信、支付宝、银行卡</span>
          </div>
          <ul class="list-plain">
            <li v-for="item in reconcileItems" :key="item">{{ item }}</li>
          </ul>
        </article>
      </aside>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>资金流水审计</h2>
        <span class="muted">展示手工转账、补款、资产调整等操作记录</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>追踪号</th>
            <th>操作类型</th>
            <th>目标用户</th>
            <th>金额</th>
            <th>操作人</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ledgerRows" :key="row.traceId">
            <td>{{ row.traceId }}</td>
            <td>{{ row.type }}</td>
            <td>{{ row.target }}</td>
            <td>{{ row.amount }}</td>
            <td>{{ row.operator }}</td>
            <td>{{ row.updatedAt }}</td>
          </tr>
          <tr v-if="!ledgerRows.length">
            <td colspan="6" class="table-empty">暂无流水记录</td>
          </tr>
        </tbody>
      </table>
    </section>

    <ActionDialog
      :open="fundDialog.open"
      :title="fundDialog.mode === 'transfer' ? '手工转账' : fundDialog.mode === 'topup' ? '补款处理' : '资产调整'"
      description="变更会直接写入资金流水与审计日志。"
      :confirm-text="fundDialog.mode === 'transfer' ? '确认转账' : fundDialog.mode === 'topup' ? '确认补款' : '确认调整'"
      :loading="dialogLoading"
      :confirm-disabled="!fundDialog.uid.trim() || !fundDialog.reason.trim()"
      @close="fundDialog.open = false"
      @confirm="submitFundDialog"
    >
      <div class="dialog-grid two-col">
        <label>
          目标用户 UID
          <input v-model="fundDialog.uid" placeholder="请输入目标用户 UID" />
        </label>
        <label>
          金额
          <input v-model="fundDialog.amount" placeholder="请输入金额" />
        </label>
        <label v-if="fundDialog.mode !== 'topup'">
          方向
          <select v-model="fundDialog.direction">
            <option value="increase">增加</option>
            <option value="decrease">减少</option>
          </select>
        </label>
        <label :style="{ gridColumn: fundDialog.mode === 'topup' ? 'span 2' : 'span 1' }">
          原因
          <textarea v-model="fundDialog.reason" placeholder="请输入处理原因" />
        </label>
      </div>
    </ActionDialog>

    <ActionDialog
      :open="rechargeDetailDialog.open"
      title="充值订单详情"
      description="完整充值订单信息"
      confirm-text="关闭"
      :cancel-text="''"
      @close="rechargeDetailDialog.open = false"
      @confirm="rechargeDetailDialog.open = false"
    >
      <div class="kv-list">
        <div class="kv-item"><strong>订单号</strong><span>{{ rechargeDetailDialog.row.orderId }}</span></div>
        <div class="kv-item"><strong>用户UID</strong><span>{{ rechargeDetailDialog.row.uid }}</span></div>
        <div class="kv-item"><strong>昵称</strong><span>{{ rechargeDetailDialog.row.nickname }}</span></div>
        <div class="kv-item"><strong>手机号</strong><span>{{ maskPhone(rechargeDetailDialog.row.phone) }}</span></div>
        <div class="kv-item"><strong>支付渠道</strong><span>{{ rechargeDetailDialog.row.channel }}</span></div>
        <div class="kv-item"><strong>金额</strong><span>{{ rechargeDetailDialog.row.amount }}</span></div>
        <div class="kv-item"><strong>状态</strong><span>{{ rechargeDetailDialog.row.status }}</span></div>
        <div class="kv-item"><strong>创建时间</strong><span>{{ rechargeDetailDialog.row.createdAt }}</span></div>
        <div class="kv-item"><strong>追踪号</strong><span>{{ rechargeDetailDialog.row.traceId }}</span></div>
      </div>
    </ActionDialog>

    <ActionDialog
      :open="withdrawDetail.open"
      title="提现详情"
      description="提现订单详细信息"
      confirm-text="关闭"
      :cancel-text="''"
      @close="withdrawDetail.open = false"
      @confirm="withdrawDetail.open = false"
    >
      <div class="kv-list">
        <div class="kv-item"><strong>订单号</strong><span>{{ withdrawDetail.row.orderId }}</span></div>
        <div class="kv-item"><strong>用户UID</strong><span>{{ withdrawDetail.row.uid }}</span></div>
        <div class="kv-item"><strong>昵称</strong><span>{{ withdrawDetail.row.nickname }}</span></div>
        <div class="kv-item"><strong>手机号</strong><span>{{ maskPhone(withdrawDetail.row.phone) }}</span></div>
        <div class="kv-item"><strong>提现金额</strong><span>{{ withdrawDetail.row.amount }}</span></div>
        <div class="kv-item"><strong>支付渠道</strong><span>{{ withdrawDetail.row.channel }}</span></div>
        <div class="kv-item"><strong>收款账户</strong><span>{{ withdrawDetail.row.payout }}</span></div>
        <div class="kv-item"><strong>申请时间</strong><span>{{ withdrawDetail.row.createdAt }}</span></div>
        <div class="kv-item"><strong>审核状态</strong><span>{{ getWithdrawStatusLabel(withdrawDetail.row.status) }}</span></div>
        <div class="kv-item"><strong>提醒状态</strong><span>{{ getWithdrawAlertStatusLabel(withdrawDetail.row.alertStatus) }}</span></div>
      </div>
      <div class="dialog-actions-row" v-if="withdrawDetail.row.status === WITHDRAW_STATUS.PENDING_REVIEW">
        <button class="primary" @click="handleApproveWithdrawal(withdrawDetail.row.orderId); withdrawDetail.open = false">通过</button>
        <button class="warn" @click="openRejectDialog(withdrawDetail.row.orderId); withdrawDetail.open = false">拒绝</button>
      </div>
      <div class="dialog-actions-row" v-if="withdrawDetail.row.status === WITHDRAW_STATUS.TRANSFER_PROCESSING">
        <button class="primary" @click="handleConfirmCompleted(withdrawDetail.row.orderId); withdrawDetail.open = false">标记转账完成</button>
      </div>
    </ActionDialog>

    <ActionDialog
      :open="rejectDialog.open"
      title="拒绝提现"
      description="请填写拒绝原因"
      confirm-text="确认拒绝"
      :loading="dialogLoading"
      danger
      @close="rejectDialog.open = false"
      @confirm="submitRejectDialog"
    >
      <label class="dialog-label">
        拒绝原因
        <textarea v-model="rejectDialog.reason" rows="3" placeholder="请输入拒绝原因"></textarea>
      </label>
    </ActionDialog>
  </template>

  <!-- ========== 平台总览 ========== -->
  <template v-else>
    <section class="panel">
      <div class="actions">
        <button class="primary" @click="loadPlatformData" :disabled="platformLoading">{{ platformLoading ? '刷新中...' : '刷新数据' }}</button>
        <button @click="openAlertDialog">预警设置</button>
      </div>
      <p v-if="error" class="login-error">{{ error }}</p>
      <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
    </section>

    <section class="grid-4">
      <article class="stat-card">
        <p class="stat-label">总充值金额</p>
        <p class="stat-value">{{ formatCurrency(funds.totalRecharge) }}</p>
        <p class="note">平台累计充值总额</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">总提现金额</p>
        <p class="stat-value">{{ formatCurrency(funds.totalWithdraw) }}</p>
        <p class="note">平台累计提现总额</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">平台当前余额</p>
        <p class="stat-value">{{ formatCurrency(funds.platformBalance) }}</p>
        <p class="note">可用运营资金</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">冻结金额</p>
        <p class="stat-value">{{ formatCurrency(funds.frozenAmount) }}</p>
        <p class="note">用户冻结资产</p>
      </article>
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
</template>

<style scoped>
.dialog-actions-row {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}
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