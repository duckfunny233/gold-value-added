<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  traceId: '',
  uid: '',
  module: '',
  eventType: '',
  timeRange: 'today',
})

useQueryFilters(filters, ['traceId', 'uid', 'module', 'eventType', 'timeRange'])

const rows = ref([])
const detailItems = ref([])
const selectedTraceId = ref('')
const loading = ref(false)
const error = ref('')
const actionMessage = ref('')
const pageSize = 10
const currentPage = ref(1)

const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return rows.value.slice(start, start + pageSize)
})

function syncCurrentPage(traceId) {
  const index = rows.value.findIndex((item) => item.traceId === traceId)
  if (index >= 0) {
    currentPage.value = Math.floor(index / pageSize) + 1
    return
  }
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getAudit(filters)
    rows.value = data.rows || []
    detailItems.value = data.detailItems || []
    const nextTraceId =
      rows.value.find((item) => item.traceId === selectedTraceId.value)?.traceId ||
      rows.value.find((item) => item.traceId === filters.traceId)?.traceId ||
      rows.value[0]?.traceId ||
      ''
    selectedTraceId.value = nextTraceId
    syncCurrentPage(nextTraceId)
  } catch (err) {
    error.value = err.message || '审计数据加载失败'
  } finally {
    loading.value = false
  }
}

function getCurrentTraceId() {
  return selectedTraceId.value || filters.traceId || rows.value[0]?.traceId || ''
}

async function loadTraceDetail(traceId) {
  if (!traceId) {
    error.value = '请先选择或输入 traceId'
    return
  }
  error.value = ''
  selectedTraceId.value = traceId
  syncCurrentPage(traceId)
  try {
    const detail = await AdminService.getAuditTrace(traceId)
    detailItems.value = AdminService.mapAuditTraceToDetailItems(detail)
  } catch (err) {
    error.value = err.message || 'trace 详情加载失败'
  }
}

function goToPage(page) {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
}

async function runAction(handler, successMessage) {
  error.value = ''
  actionMessage.value = ''
  try {
    await handler()
    actionMessage.value = successMessage
    if (getCurrentTraceId()) {
      await loadTraceDetail(getCurrentTraceId())
    }
  } catch (err) {
    error.value = err.message || '审计操作失败'
  }
}

async function handleVerifyHash() {
  const traceId = getCurrentTraceId()
  if (!traceId) {
    error.value = '请先选择一条链路'
    return
  }
  await runAction(() => AdminService.verifyAuditTraceHash(traceId), `trace ${traceId} 哈希校验已完成`)
}

async function handleExportTrace() {
  const traceId = getCurrentTraceId()
  if (!traceId) {
    error.value = '请先选择一条链路'
    return
  }
  await runAction(() => AdminService.exportAuditTrace(traceId, 'csv'), `trace ${traceId} 已导出`)
}

async function handleCompareData() {
  const traceId = getCurrentTraceId()
  if (!traceId) {
    error.value = '请先选择一条链路'
    return
  }
  await loadTraceDetail(traceId)
  actionMessage.value = `trace ${traceId} 链路详情已刷新`
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="审计追溯" description="支持按追踪号追踪全链路操作，完成数据溯源、防伪校验和合规审计。" />

  <section class="panel">
    <div class="form-row">
      <label>追踪号<input v-model="filters.traceId" placeholder="请输入追踪号" /></label>
      <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
      <label>
        所属模块
        <select v-model="filters.module">
          <option value="">全部</option>
          <option value="funds">资金管理</option>
          <option value="trades">交易管理</option>
          <option value="risk">权限与风控</option>
        </select>
      </label>
      <label>
        事件类型
        <select v-model="filters.eventType">
          <option value="">全部</option>
          <option value="deposit">充值</option>
          <option value="withdraw">提现</option>
          <option value="trade">买卖</option>
          <option value="admin">后台操作</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查看链路' }}</button>
      <button @click="handleExportTrace">导出链路</button>
      <button @click="handleVerifyHash">校验哈希</button>
      <button @click="handleCompareData">对比数据</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>日志与流水列表</h2>
        <span class="muted">同一追踪号应串联交易、资金、风控和同步日志</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>追踪号</th>
            <th>所属模块</th>
            <th>事件类型</th>
            <th>用户UID</th>
            <th>业务单号</th>
            <th>哈希值</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!pagedRows.length">
            <td class="table-empty" colspan="7">暂无符合条件的审计记录</td>
          </tr>
          <tr
            v-for="row in pagedRows"
            :key="row.traceId"
            @click="loadTraceDetail(row.traceId)"
            :class="{ 'is-selected': selectedTraceId === row.traceId }"
          >
            <td>{{ row.traceId }}</td>
            <td>{{ row.module }}</td>
            <td>{{ row.eventType }}</td>
            <td>{{ row.uid }}</td>
            <td>{{ row.bizOrderId }}</td>
            <td>{{ row.hashValue }}</td>
            <td>{{ row.createdAt }}</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar">
        <span class="muted">共 {{ rows.length }} 条，当前第 {{ currentPage }} / {{ totalPages }} 页，每页 10 条</span>
        <div class="actions compact">
          <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">上一页</button>
          <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">下一页</button>
        </div>
      </div>
    </article>

    <aside class="panel">
      <div class="panel-head">
        <h2>链路详情面板</h2>
        <span class="muted">未选中记录时禁用“校验哈希”按钮</span>
      </div>
      <div class="kv-list">
        <div class="kv-item" v-for="item in detailItems" :key="item.key">
          <strong>{{ item.label }}</strong>
          <span>{{ item.value }}</span>
        </div>
      </div>
    </aside>
  </section>
</template>
