<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  reportType: '',
  name: '',
  status: '',
  generatedBy: '',
  timeRange: '7d',
})

useQueryFilters(filters, ['reportType', 'name', 'status', 'generatedBy', 'timeRange'])

const REPORT_NAME_MAP = {
  operate: '运营数据',
  finance: '财务/交易数据',
  risk: '风控规则',
  audit: '审计追溯',
}

const cards = ref([])
const exportsList = ref([])
const selectedJobId = ref('')
const loading = ref(false)
const error = ref('')
const actionMessage = ref('')

function triggerDownload(fileName, content, contentType) {
  const blob = new Blob([content], { type: contentType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [reportData, jobsData] = await Promise.all([
      AdminService.getReports(filters),
      AdminService.getReportJobs({
        reportType: filters.reportType,
        name: filters.name,
        status: filters.status,
        generatedBy: filters.generatedBy,
        timeRange: filters.timeRange,
      }),
    ])
    cards.value = reportData.cards || []
    const jobRows = AdminService.normalizeReportJobRows(jobsData.rows || [])
    exportsList.value = jobRows.length ? jobRows : reportData.exportsList || []
    selectedJobId.value = jobRows[0]?.jobId || ''
  } catch (err) {
    error.value = err.message || '报表数据加载失败'
  } finally {
    loading.value = false
  }
}

function getSelectedJobId() {
  return selectedJobId.value || exportsList.value.find((item) => item.jobId)?.jobId || ''
}

async function runAction(handler, successMessage) {
  error.value = ''
  actionMessage.value = ''
  try {
    await handler()
    actionMessage.value = successMessage
    await loadData()
  } catch (err) {
    error.value = err.message || '报表操作失败'
  }
}

async function handleGenerateReport() {
  await runAction(
    () =>
      AdminService.generateReport({
        reportType: filters.reportType || 'operate',
        timeRange: filters.timeRange,
        format: 'csv',
        name: `${REPORT_NAME_MAP[filters.reportType] || '自定义'}报表`,
      }),
    '报表任务已生成',
  )
}

async function handleExportReport(format) {
  const jobId = getSelectedJobId()
  if (!jobId) {
    error.value = '请先选中一条报表任务'
    return
  }
  error.value = ''
  actionMessage.value = ''
  try {
    const result = await AdminService.exportReportJob(jobId, { format })
    triggerDownload(result.fileName, result.content || '', result.contentType)
    actionMessage.value = `报表已按 ${format.toUpperCase()} 导出`
    await loadData()
  } catch (err) {
    error.value = err.message || '报表操作失败'
  }
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="报表中心" />

  <section class="panel">
    <div class="form-row">
      <label>
        报表名称
        <input v-model="filters.name" placeholder="关键词搜索" />
      </label>
      <label>
        来源页面/模块
        <select v-model="filters.reportType">
          <option value="">全部</option>
          <option value="user">用户管理</option>
          <option value="leaderboard">排行榜治理</option>
          <option value="trade">交易管理</option>
          <option value="funds">资金管理</option>
        </select>
      </label>
      <label>
        状态
        <select v-model="filters.status">
          <option value="">全部</option>
          <option value="SUCCEEDED">已完成</option>
          <option value="RUNNING">生成中</option>
          <option value="FAILED">失败</option>
          <option value="PENDING">待生成</option>
        </select>
      </label>
      <label>
        生成时间
        <select v-model="filters.timeRange">
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
          <option value="90d">最近90天</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="handleGenerateReport" :disabled="loading">生成报表</button>
      <button @click="handleExportReport('csv')">导出 CSV</button>
      <button @click="handleExportReport('excel')">导出 Excel</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>导出列表区</h2>
      <span class="muted">点击行选中报表后，可导出 CSV 或 Excel</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="min-width:160px">报表名称</th>
          <th>生成时间</th>
          <th>生成人</th>
          <th>汇总规则</th>
          <th>来源页面/模块</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in exportsList"
          :key="row.jobId || row.name"
          @click="selectedJobId = row.jobId || ''"
          :class="{ 'is-selected': selectedJobId === row.jobId }"
        >
          <td class="cell-name">{{ row.name }}</td>
          <td>{{ row.generatedAt }}</td>
          <td>{{ row.generatedBy }}</td>
          <td>{{ row.aggregationRule }}</td>
          <td>{{ row.dataSourceModules }}</td>
          <td>{{ row.status }}</td>
        </tr>
        <tr v-if="!exportsList.length">
          <td colspan="6" class="table-empty">暂无报表记录，请先生成报表任务</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.cell-name {
  font-weight: 600;
  color: var(--primary, #0b7285);
}
</style>
