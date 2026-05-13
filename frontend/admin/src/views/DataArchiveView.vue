<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import ActionDialog from '../components/ActionDialog.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { ArchiveService } from '../services/archive'

const activeTab = ref('tasks')

const config = reactive({
  tradeRetainYears: 3,
  logRetainYears: 1,
  userDataRetainYears: 5,
})

const triggerForm = reactive({
  tableName: '',
  startTime: '',
  endTime: '',
})

const taskFilters = reactive({
  status: '',
  operator: '',
})

const recordFilters = reactive({
  tableName: '',
  startTime: '',
  endTime: '',
})

useQueryFilters(recordFilters, ['tableName', 'startTime', 'endTime'])

const tasks = ref([])
const records = ref([])
const previewData = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const actionMessage = ref('')

const pageSize = 10
const taskPage = ref(1)
const recordPage = ref(1)
const taskTotal = ref(0)
const recordTotal = ref(0)

const taskTotalPages = computed(() => Math.max(1, Math.ceil(taskTotal.value / pageSize)))
const recordTotalPages = computed(() => Math.max(1, Math.ceil(recordTotal.value / pageSize)))

const confirmDialog = reactive({
  open: false,
  title: '',
  description: '',
  onConfirm: null,
})

const previewDialog = reactive({
  open: false,
  recordId: '',
  tableName: '',
})

const statusMap = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
}

const statusClassMap = {
  pending: 'badge-warn',
  running: 'badge-info',
  completed: 'badge-success',
  failed: 'badge-danger',
}

async function loadConfig() {
  loading.value = true
  error.value = ''
  try {
    const data = await ArchiveService.getArchiveConfig()
    if (data.tradeRetainYears != null) config.tradeRetainYears = data.tradeRetainYears
    if (data.logRetainYears != null) config.logRetainYears = data.logRetainYears
    if (data.userDataRetainYears != null) config.userDataRetainYears = data.userDataRetainYears
  } catch (err) {
    error.value = err.message || '归档配置加载失败'
  } finally {
    loading.value = false
  }
}

async function loadTasks() {
  loading.value = true
  error.value = ''
  try {
    const data = await ArchiveService.getArchiveTasks({
      ...taskFilters,
      page: taskPage.value,
      pageSize,
    })
    tasks.value = data.rows || []
    taskTotal.value = data.total || tasks.value.length
  } catch (err) {
    error.value = err.message || '归档任务加载失败'
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  loading.value = true
  error.value = ''
  try {
    const data = await ArchiveService.getArchiveRecords({
      ...recordFilters,
      page: recordPage.value,
      pageSize,
    })
    records.value = data.rows || []
    recordTotal.value = data.total || records.value.length
  } catch (err) {
    error.value = err.message || '归档记录加载失败'
  } finally {
    loading.value = false
  }
}

function openConfirmDialog(title, description, onConfirm) {
  confirmDialog.title = title
  confirmDialog.description = description
  confirmDialog.onConfirm = onConfirm
  confirmDialog.open = true
}

async function handleSaveConfig() {
  saving.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await ArchiveService.updateArchiveConfig({
      tradeRetainYears: config.tradeRetainYears,
      logRetainYears: config.logRetainYears,
      userDataRetainYears: config.userDataRetainYears,
    })
    actionMessage.value = '归档策略已保存'
  } catch (err) {
    error.value = err.message || '保存失败'
  } finally {
    saving.value = false
    confirmDialog.open = false
  }
}

function confirmSaveConfig() {
  openConfirmDialog(
    '保存归档策略',
    '确认保存当前归档策略配置？',
    handleSaveConfig,
  )
}

async function handleTriggerArchive() {
  if (!triggerForm.tableName || !triggerForm.startTime || !triggerForm.endTime) {
    error.value = '请填写完整的归档条件'
    return
  }
  saving.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await ArchiveService.triggerArchive({
      tableName: triggerForm.tableName,
      startTime: triggerForm.startTime,
      endTime: triggerForm.endTime,
    })
    actionMessage.value = '归档任务已触发'
    triggerForm.tableName = ''
    triggerForm.startTime = ''
    triggerForm.endTime = ''
    await loadTasks()
  } catch (err) {
    error.value = err.message || '触发归档失败'
  } finally {
    saving.value = false
    confirmDialog.open = false
  }
}

function confirmTriggerArchive() {
  openConfirmDialog(
    '触发手动归档',
    `确认对 ${triggerForm.tableName} 执行归档？时间范围：${triggerForm.startTime} 至 ${triggerForm.endTime}`,
    handleTriggerArchive,
  )
}

async function handlePreview(record) {
  loading.value = true
  error.value = ''
  try {
    const data = await ArchiveService.previewArchiveData(record.id)
    previewData.value = data.rows || []
    previewDialog.recordId = record.id
    previewDialog.tableName = record.tableName
    previewDialog.open = true
  } catch (err) {
    error.value = err.message || '预览加载失败'
  } finally {
    loading.value = false
  }
}

async function handleExport(record, format) {
  loading.value = true
  error.value = ''
  try {
    await ArchiveService.exportArchiveData(record.id, format)
    actionMessage.value = `归档记录 ${record.id} 已导出`
  } catch (err) {
    error.value = err.message || '导出失败'
  } finally {
    loading.value = false
  }
}

function goToTaskPage(page) {
  taskPage.value = Math.min(Math.max(page, 1), taskTotalPages.value)
  loadTasks()
}

function goToRecordPage(page) {
  recordPage.value = Math.min(Math.max(page, 1), recordTotalPages.value)
  loadRecords()
}

function refreshCurrentTab() {
  error.value = ''
  actionMessage.value = ''
  if (activeTab.value === 'tasks') loadTasks()
  if (activeTab.value === 'records') loadRecords()
  if (activeTab.value === 'config') loadConfig()
}

onMounted(() => {
  loadTasks()
  loadRecords()
  loadConfig()
})
</script>

<template>
  <PageHeader title="数据归档管理" description="管理数据归档策略、执行归档任务及查询归档记录。" />

  <section class="panel">
    <div class="tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'tasks' }" @click="activeTab = 'tasks'">归档任务</button>
      <button class="tab-btn" :class="{ active: activeTab === 'records' }" @click="activeTab = 'records'">归档记录</button>
      <button class="tab-btn" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">归档策略</button>
      <button class="tab-btn" :class="{ active: activeTab === 'trigger' }" @click="activeTab = 'trigger'">手动归档</button>
    </div>
  </section>

  <section v-if="activeTab === 'tasks'" class="panel">
    <div class="panel-head">
      <h2>归档任务列表</h2>
      <span class="muted">查看归档任务执行状态</span>
    </div>
    <div class="form-row">
      <label>
        任务状态
        <select v-model="taskFilters.status">
          <option value="">全部</option>
          <option value="pending">待执行</option>
          <option value="running">执行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
        </select>
      </label>
      <label>
        操作人
        <input v-model="taskFilters.operator" placeholder="请输入操作人" />
      </label>
      <button class="primary" @click="loadTasks" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>任务ID</th>
          <th>表名</th>
          <th>状态</th>
          <th>执行时间</th>
          <th>归档数据量</th>
          <th>操作人</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="task in tasks" :key="task.id">
          <td>{{ task.id }}</td>
          <td>{{ task.tableName }}</td>
          <td>
            <span class="badge" :class="statusClassMap[task.status] || ''">{{ statusMap[task.status] || task.status }}</span>
          </td>
          <td>{{ task.executedAt || '-' }}</td>
          <td>{{ task.dataCount != null ? task.dataCount : '-' }}</td>
          <td>{{ task.operator || '-' }}</td>
        </tr>
        <tr v-if="!tasks.length">
          <td colspan="6" class="table-empty">暂无归档任务</td>
        </tr>
      </tbody>
    </table>
    <div class="pagination-bar">
      <span class="muted">共 {{ taskTotal }} 条，当前第 {{ taskPage }} / {{ taskTotalPages }} 页，每页 {{ pageSize }} 条</span>
      <div class="actions compact">
        <button @click="goToTaskPage(taskPage - 1)" :disabled="taskPage <= 1">上一页</button>
        <button @click="goToTaskPage(taskPage + 1)" :disabled="taskPage >= taskTotalPages">下一页</button>
      </div>
    </div>
  </section>

  <section v-if="activeTab === 'records'" class="panel">
    <div class="panel-head">
      <h2>归档记录查询</h2>
      <span class="muted">按表名和时间范围检索已归档数据</span>
    </div>
    <div class="form-row">
      <label>
        表名
        <input v-model="recordFilters.tableName" placeholder="请输入表名" />
      </label>
      <label>
        开始时间
        <input v-model="recordFilters.startTime" type="date" />
      </label>
      <label>
        结束时间
        <input v-model="recordFilters.endTime" type="date" />
      </label>
      <button class="primary" @click="loadRecords" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>记录ID</th>
          <th>表名</th>
          <th>归档时间范围</th>
          <th>数据量</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td>{{ record.id }}</td>
          <td>{{ record.tableName }}</td>
          <td>{{ record.startTime }} ~ {{ record.endTime }}</td>
          <td>{{ record.dataCount != null ? record.dataCount : '-' }}</td>
          <td>{{ record.createdAt }}</td>
          <td>
            <div class="cell-actions">
              <button class="primary" type="button" @click="handlePreview(record)">预览</button>
              <button type="button" @click="handleExport(record, 'csv')">导出CSV</button>
            </div>
          </td>
        </tr>
        <tr v-if="!records.length">
          <td colspan="6" class="table-empty">暂无归档记录</td>
        </tr>
      </tbody>
    </table>
    <div class="pagination-bar">
      <span class="muted">共 {{ recordTotal }} 条，当前第 {{ recordPage }} / {{ recordTotalPages }} 页，每页 {{ pageSize }} 条</span>
      <div class="actions compact">
        <button @click="goToRecordPage(recordPage - 1)" :disabled="recordPage <= 1">上一页</button>
        <button @click="goToRecordPage(recordPage + 1)" :disabled="recordPage >= recordTotalPages">下一页</button>
      </div>
    </div>
  </section>

  <section v-if="activeTab === 'config'" class="panel">
    <div class="panel-head">
      <h2>归档策略配置</h2>
      <span class="muted">设置各类数据的保留年限</span>
    </div>
    <div class="form-grid">
      <label>
        交易流水保留年限
        <input v-model.number="config.tradeRetainYears" type="number" min="1" max="10" step="1" />
      </label>
      <label>
        日志保留年限
        <input v-model.number="config.logRetainYears" type="number" min="1" max="10" step="1" />
      </label>
      <label>
        用户数据保留年限
        <input v-model.number="config.userDataRetainYears" type="number" min="1" max="10" step="1" />
      </label>
    </div>
    <div class="actions" style="margin-top: 16px;">
      <button class="primary" @click="confirmSaveConfig" :disabled="saving">{{ saving ? '保存中...' : '保存策略' }}</button>
      <button @click="loadConfig" :disabled="loading">{{ loading ? '加载中...' : '重置' }}</button>
    </div>
  </section>

  <section v-if="activeTab === 'trigger'" class="panel">
    <div class="panel-head">
      <h2>手动归档触发</h2>
      <span class="muted">选择时间范围执行手动归档</span>
    </div>
    <div class="form-grid">
      <label>
        目标表名
        <input v-model="triggerForm.tableName" placeholder="例如：trade_records" />
      </label>
      <label>
        开始时间
        <input v-model="triggerForm.startTime" type="date" />
      </label>
      <label>
        结束时间
        <input v-model="triggerForm.endTime" type="date" />
      </label>
    </div>
    <div class="actions" style="margin-top: 16px;">
      <button class="primary" @click="confirmTriggerArchive" :disabled="saving">{{ saving ? '执行中...' : '执行归档' }}</button>
      <button @click="triggerForm.tableName = ''; triggerForm.startTime = ''; triggerForm.endTime = ''">清空</button>
    </div>
  </section>

  <section v-if="activeTab !== 'config' && activeTab !== 'trigger'" class="panel actions-bar">
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>
  <section v-else class="panel actions-bar">
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <ActionDialog
    :open="confirmDialog.open"
    :title="confirmDialog.title"
    :description="confirmDialog.description"
    confirm-text="确认"
    :loading="saving"
    danger
    @close="confirmDialog.open = false"
    @confirm="confirmDialog.onConfirm"
  />

  <ActionDialog
    :open="previewDialog.open"
    :title="`归档数据预览 - ${previewDialog.tableName}`"
    description="抽样查看已归档数据内容"
    confirm-text="关闭"
    :cancel-text="''"
    @close="previewDialog.open = false"
    @confirm="previewDialog.open = false"
  >
    <div class="preview-table-wrap">
      <table v-if="previewData.length" class="preview-table">
        <thead>
          <tr>
            <th v-for="key in Object.keys(previewData[0])" :key="key">{{ key }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in previewData" :key="index">
            <td v-for="key in Object.keys(previewData[0])" :key="key">{{ row[key] }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">暂无预览数据</p>
    </div>
  </ActionDialog>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.form-grid input,
.form-grid select {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
.actions-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.preview-table-wrap {
  max-height: 400px;
  overflow: auto;
}
.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.preview-table th,
.preview-table td {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e5e7eb);
  text-align: left;
}
.preview-table th {
  background: var(--bg-secondary, #f3f4f6);
  font-weight: 600;
}
</style>
