<script setup>
import { onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'
import {
  getWithdrawAlertStatusLabel,
  getWithdrawStatusLabel,
  WITHDRAW_STATUS,
} from '../../../shared/constants/status'

const filters = reactive({
  orderType: '',
  uid: '',
  channel: '',
  status: '',
  timeRange: 'today',
})

const activeTab = ref('recharge')
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

useQueryFilters(filters, ['orderType', 'uid', 'channel', 'status', 'timeRange'])

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
  } catch (err) {
    error.value = err.message || '资金数据加载失败'
  } finally {
    loading.value = false
  }
}

function getSelectedWithdrawal() {
  return withdrawRows.value.find((item) => item.orderId === selectedWithdrawalId.value) || null
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

onMounted(loadData)
</script>

<template>
  <PageHeader title="资金管理" description="处理充值对账、提现审核、补款转账、资产调整和支付渠道对账。" />

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

  <section class="split-main-aside">
    <article class="panel">
      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'recharge' }" @click="activeTab = 'recharge'">充值订单</button>
        <button class="tab-btn" :class="{ active: activeTab === 'withdraw' }" @click="activeTab = 'withdraw'">提现订单</button>
      </div>

      <div v-if="activeTab === 'recharge'">
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
              <th>支付渠道</th>
              <th>金额</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>追踪号</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rechargeRows" :key="row.orderId">
              <td>{{ row.orderId }}</td>
              <td>{{ row.uid }}</td>
              <td>{{ row.nickname }}</td>
              <td>{{ row.channel }}</td>
              <td>{{ row.amount }}</td>
              <td>{{ row.status }}</td>
              <td>{{ row.createdAt }}</td>
              <td>{{ row.traceId }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else>
        <div class="panel-head">
          <h2>提现审核队列</h2>
          <span class="muted">按提交时间顺序排队，需展示收款信息</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>用户UID</th>
              <th>昵称</th>
              <th>支付渠道</th>
              <th>金额</th>
              <th>审核状态</th>
              <th>提醒状态</th>
              <th>收款信息</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in withdrawRows"
              :key="row.orderId"
              @click="selectedWithdrawalId = row.orderId"
              :class="{ 'is-selected': selectedWithdrawalId === row.orderId }"
            >
              <td>{{ row.orderId }}</td>
              <td>{{ row.uid }}</td>
              <td>{{ row.nickname }}</td>
              <td>{{ row.channel }}</td>
              <td>{{ row.amount }}</td>
              <td>{{ getWithdrawStatusLabel(row.status) }}</td>
              <td>{{ getWithdrawAlertStatusLabel(row.alertStatus) }}</td>
              <td>{{ row.payout }}</td>
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
</template>
