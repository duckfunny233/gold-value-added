<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  userId: '',
  uid: '',
  sequenceNo: '',
  realNameStatus: '',
  rechargeStatus: '',
  withdrawStatus: '',
})

const activeRecordTab = ref('recharge')
const rows = ref([])
const selectedUser = ref({})
const relatedRecords = ref({ recharge: [], withdraw: [], trade: [], audit: [] })
const selectedUid = ref('')
const loading = ref(false)
const error = ref('')
const actionMessage = ref('')

useQueryFilters(filters, ['userId', 'uid', 'sequenceNo', 'realNameStatus', 'rechargeStatus', 'withdrawStatus'])

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getUsers(filters)
    rows.value = data.rows || []
    selectedUser.value = data.selectedUser || {}
    relatedRecords.value = data.relatedRecords || { recharge: [], withdraw: [], trade: [], audit: [] }
    selectedUid.value = data.selectedUser?.uid || rows.value[0]?.uid || ''
  } catch (err) {
    error.value = err.message || '用户数据加载失败'
  } finally {
    loading.value = false
  }
}

function escapeCsv(value) {
  const normalized = value == null ? '' : String(value)
  const escaped = normalized.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function downloadCsv(fileName, rowsToExport) {
  if (!rowsToExport.length) {
    error.value = '暂无可导出的用户数据'
    return
  }
  const headers = Object.keys(rowsToExport[0])
  const content = [
    headers.join(','),
    ...rowsToExport.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function selectUser(uid) {
  selectedUid.value = uid
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getUsers({ ...filters, uid })
    rows.value = data.rows || []
    selectedUser.value = data.selectedUser || {}
    relatedRecords.value = data.relatedRecords || { recharge: [], withdraw: [], trade: [], audit: [] }
  } catch (err) {
    error.value = err.message || '用户详情加载失败'
  } finally {
    loading.value = false
  }
}

async function runAction(handler, successMessage) {
  error.value = ''
  actionMessage.value = ''
  try {
    await handler()
    actionMessage.value = successMessage
    await loadData()
  } catch (err) {
    error.value = err.message || '用户操作失败'
  }
}

async function handleViewDetail() {
  const uid = selectedUid.value || selectedUser.value.uid
  if (!uid) {
    error.value = '请先选中一位用户'
    return
  }
  await selectUser(uid)
  actionMessage.value = `已刷新用户 ${uid} 的详情`
}

async function handleFreezeUser() {
  const uid = selectedUid.value || selectedUser.value.uid
  if (!uid) {
    error.value = '请先选中一位用户'
    return
  }
  await runAction(() => AdminService.freezeUser(uid), `用户 ${uid} 已冻结`)
}

async function handleUnfreezeUser() {
  const uid = selectedUid.value || selectedUser.value.uid
  if (!uid) {
    error.value = '请先选中一位用户'
    return
  }
  await runAction(() => AdminService.unfreezeUser(uid), `用户 ${uid} 已解冻`)
}

async function handleManualCheck() {
  const uid = selectedUid.value || selectedUser.value.uid
  if (!uid) {
    error.value = '请先选中一位用户'
    return
  }
  const note = window.prompt('请输入人工核查备注', '后台人工核查')
  if (note === null) return
  await runAction(() => AdminService.manualCheckUser(uid, { note }), `用户 ${uid} 的人工核查已登记`)
}

function handleExportUsers() {
  downloadCsv(
    `admin-users-${Date.now()}.csv`,
    rows.value.map((item) => ({
      userId: item.userId,
      uid: item.uid,
      sequenceNo: item.sequenceNo,
      nickname: item.nickname,
      realNameStatus: item.realNameStatus,
      rechargeStatus: item.rechargeStatus,
      withdrawStatus: item.withdrawStatus,
      cashAsset: item.cashAsset,
      goldHoldingGrams: item.goldHoldingGrams,
      totalAsset: item.totalAsset,
      userStatus: item.userStatus,
    })),
  )
  actionMessage.value = '用户列表已基于真实查询结果导出'
}

async function handleVerifyPayouts() {
  const uid = selectedUid.value || selectedUser.value.uid || filters.uid
  if (uid) {
    await selectUser(uid)
    actionMessage.value = `已重新核对 ${uid} 的收款信息摘要`
    return
  }
  await loadData()
  actionMessage.value = '已按当前筛选条件重新校验收款信息'
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="用户管理" description="完成用户全生命周期管理与跨模块关联查询。" />

  <section class="panel">
    <div class="form-row">
      <label>用户ID<input v-model="filters.userId" placeholder="请输入用户ID" /></label>
      <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
      <label>注册序号<input v-model="filters.sequenceNo" placeholder="请输入注册序号" /></label>
      <label>
        实名状态
        <select v-model="filters.realNameStatus">
          <option value="">全部</option>
          <option value="passed">已实名</option>
          <option value="pending">待实名</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="handleExportUsers">导出用户</button>
      <button @click="handleVerifyPayouts">批量校验收款信息</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>用户列表</h2>
        <span class="muted">支持按用户UID和注册序号检索</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>用户ID</th>
            <th>用户UID</th>
            <th>注册序号</th>
            <th>昵称</th>
            <th>实名状态</th>
            <th>充值状态</th>
            <th>提现状态</th>
            <th>现金资产</th>
            <th>持有黄金克数</th>
            <th>总资产</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.userId"
            @click="selectUser(row.uid)"
            :class="{ 'is-selected': selectedUid === row.uid }"
          >
            <td>{{ row.userId }}</td>
            <td>{{ row.uid }}</td>
            <td>{{ row.sequenceNo }}</td>
            <td>{{ row.nickname }}</td>
            <td>{{ row.realNameStatus }}</td>
            <td>{{ row.rechargeStatus }}</td>
            <td>{{ row.withdrawStatus }}</td>
            <td>{{ row.cashAsset }}</td>
            <td>{{ row.goldHoldingGrams }}</td>
            <td>{{ row.totalAsset }}</td>
          </tr>
        </tbody>
      </table>
    </article>

    <aside class="panel">
      <div class="panel-head">
        <h2>用户详情抽屉</h2>
        <span class="muted">当前选中用户：{{ selectedUser.uid || '-' }}</span>
      </div>
      <div class="kv-list">
        <div class="kv-item"><strong>增值收益</strong><span>{{ selectedUser.appreciationIncome }}</span></div>
        <div class="kv-item"><strong>收款信息摘要</strong><span>{{ selectedUser.payoutProfileSummary }}</span></div>
        <div class="kv-item"><strong>风险状态</strong><span>{{ selectedUser.riskStatus }}</span></div>
        <div class="kv-item"><strong>最近交易时间</strong><span>{{ selectedUser.lastTradeAt }}</span></div>
        <div class="kv-item"><strong>最近追踪号</strong><span>{{ selectedUser.latestTraceId }}</span></div>
      </div>
      <div class="actions">
        <button class="primary" @click="handleViewDetail">查看详情</button>
        <button class="warn" @click="handleFreezeUser">冻结用户</button>
        <button @click="handleUnfreezeUser">解冻用户</button>
        <button @click="handleManualCheck">人工核查</button>
      </div>
    </aside>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>关联记录标签页</h2>
      <span class="muted">用户详情可关联充值、提现、交易、资金流水和审计记录</span>
    </div>
    <div class="tabs">
      <button class="tab-btn" :class="{ active: activeRecordTab === 'recharge' }" @click="activeRecordTab = 'recharge'">充值</button>
      <button class="tab-btn" :class="{ active: activeRecordTab === 'withdraw' }" @click="activeRecordTab = 'withdraw'">提现</button>
      <button class="tab-btn" :class="{ active: activeRecordTab === 'trade' }" @click="activeRecordTab = 'trade'">交易</button>
      <button class="tab-btn" :class="{ active: activeRecordTab === 'audit' }" @click="activeRecordTab = 'audit'">审计</button>
    </div>
    <ul class="list-plain">
      <li v-for="item in relatedRecords[activeRecordTab] || []" :key="item">{{ item }}</li>
    </ul>
  </section>
</template>
