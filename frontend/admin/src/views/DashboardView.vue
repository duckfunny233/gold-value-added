<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  date: 'today',
  module: '',
  severity: '',
})

const noticeForm = reactive({
  title: '',
  content: '',
  enabled: false,
})

const noticeDialog = reactive({
  open: false,
  mode: 'create',
  noticeId: '',
})

const deleteDialog = reactive({
  open: false,
  noticeId: '',
  title: '',
})

useQueryFilters(filters, ['date', 'module', 'severity'])

const stats = ref([])
const pendingRows = ref([])
const notices = ref([])
const events = ref([])
const monitors = ref([])
const ruleReminders = ref([])
const selectedNoticeId = ref('')
const loading = ref(false)
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')
const tradingStatus = ref('normal')

const noticeDialogTitle = computed(() => (noticeDialog.mode === 'edit' ? '编辑公告' : '新增公告'))
const noticeDialogConfirmText = computed(() => (noticeDialog.mode === 'edit' ? '确认编辑' : '确认发布'))
const statusBadgeClass = computed(() => (tradingStatus.value === 'paused' ? 'badge-danger' : 'badge-success'))
const statusText = computed(() => (tradingStatus.value === 'paused' ? '停盘中' : '交易正常'))
const recentEvents = computed(() => events.value.slice(0, 5))

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getDashboard(filters)
    stats.value = data.stats || []
    pendingRows.value = data.pendingRows || []
    notices.value = data.notices || []
    events.value = data.events || []
    monitors.value = data.monitors || []
    ruleReminders.value = data.ruleReminders || []
    tradingStatus.value = data.tradingStatus || 'normal'
    selectedNoticeId.value = notices.value[0]?.id || ''
  } catch (err) {
    error.value = err.message || '仪表盘数据加载失败'
  } finally {
    loading.value = false
  }
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
    error.value = err.message || '操作失败'
  } finally {
    dialogLoading.value = false
  }
}

function resetNoticeForm() {
  noticeForm.title = ''
  noticeForm.content = ''
  noticeDialog.noticeId = ''
}

function openCreateNoticeDialog() {
  resetNoticeForm()
  noticeDialog.mode = 'create'
  noticeDialog.open = true
}

function openEditNoticeDialog(item) {
  if (item.source !== 'local') {
    error.value = '外部新闻流公告暂不支持后台编辑'
    return
  }
  noticeDialog.mode = 'edit'
  noticeDialog.noticeId = item.id
  noticeForm.title = item.title || ''
  noticeForm.content = item.content || item.text || ''
  noticeDialog.open = true
}

function openDeleteNoticeDialog(item) {
  if (item.source !== 'local') {
    error.value = '外部新闻流公告暂不支持后台删除'
    return
  }
  deleteDialog.noticeId = item.id
  deleteDialog.title = item.title || ''
  deleteDialog.open = true
}

async function submitNoticeDialog() {
  const payload = {
    title: noticeForm.title.trim(),
    content: noticeForm.content.trim(),
  }

  if (!payload.title || !payload.content) {
    error.value = '请完整填写公告标题和内容'
    return
  }

  if (noticeDialog.mode === 'edit') {
    await runAction(
      () => AdminService.updateNotice(noticeDialog.noticeId, payload),
      '公告已更新',
    )
  } else {
    await runAction(() => AdminService.publishNotice(payload), '公告已发布')
  }

  noticeDialog.open = false
  resetNoticeForm()
}

async function submitDeleteNoticeDialog() {
  await runAction(() => AdminService.deleteNotice(deleteDialog.noticeId), '公告已删除')
  deleteDialog.open = false
}

async function submitGlobalNotice() {
  await runAction(
    () =>
      AdminService.updateSystemConfig({
        globalNotice: {
          enabled: noticeForm.enabled,
          content: noticeForm.content,
        },
      }),
    '全局公告配置已保存',
  )
}

function getModuleLabel(module) {
  const map = {
    funds: '资金管理',
    trades: '交易管理',
    risk: '权限与风控',
    audit: '审计追溯',
  }
  return map[module] || module
}

function getModuleBadgeClass(module) {
  const map = {
    funds: 'badge-success',
    trades: 'badge-success',
    risk: 'badge-danger',
    audit: 'badge-success',
  }
  return map[module] || ''
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="首页仪表盘" />

  <section class="panel">
    <div class="form-row">
      <label>
        日期范围
        <select v-model="filters.date">
          <option value="today">今日</option>
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
        </select>
      </label>
      <label>
        所属模块
        <select v-model="filters.module">
          <option value="">全部模块</option>
          <option value="funds">资金管理</option>
          <option value="trades">交易管理</option>
          <option value="risk">权限与风控</option>
          <option value="audit">审计追溯</option>
        </select>
      </label>
      <label>
        严重级别
        <select v-model="filters.severity">
          <option value="">全部</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </label>
      <div class="search-container">
        <button class="primary search-btn" @click="loadData" :disabled="loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          {{ loading ? '搜索中...' : '搜索' }}
        </button>
      </div>
    </div>
    <div class="status-bar">
      <span class="status-label">当前交易状态：</span>
      <span class="badge" :class="statusBadgeClass">{{ statusText }}</span>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '刷新仪表盘' }}</button>
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
        <h2>待处理单据</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>单号</th>
            <th>模块</th>
            <th>事项</th>
            <th>责任人</th>
            <th>级别</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pendingRows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.module }}</td>
            <td>{{ row.name }}</td>
            <td>{{ row.owner }}</td>
            <td>{{ row.level }}</td>
            <td>{{ row.time }}</td>
          </tr>
        </tbody>
      </table>
    </article>

    <aside class="stack">
      <article class="panel">
        <div class="panel-head">
        <h2>公告管理</h2>
      </div>
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>状态</th>
              <th>发布时间</th>
              <th>轮巡展示</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in notices"
              :key="item.id"
              @click="selectedNoticeId = item.id"
              :class="{ 'is-selected': selectedNoticeId === item.id }"
            >
              <td class="notice-title">{{ item.title }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.publishAt }}</td>
              <td>{{ item.pollingEnabled }}</td>
              <td>
                <div class="cell-actions">
                  <button
                    v-if="item.source === 'local'"
                    type="button"
                    @click.stop="openEditNoticeDialog(item)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="item.source === 'local'"
                    type="button"
                    @click.stop="openDeleteNoticeDialog(item)"
                  >
                    删除
                  </button>
                  <span v-if="item.source !== 'local'" class="muted">外部公告只读</span>
                </div>
              </td>
            </tr>
            <tr v-if="!notices.length">
              <td colspan="5" class="table-empty">暂无公告数据</td>
            </tr>
          </tbody>
        </table>
        <div class="actions">
          <button class="primary" @click="openCreateNoticeDialog">发布公告</button>
        </div>
      </article>
    </aside>
  </section>

  <section class="split-main-bottom">
    <article class="panel">
      <div class="panel-head">
        <h2>最近事件速览</h2>
      </div>
      <div v-if="!recentEvents.length" class="empty-state">
        <p class="muted">暂无实时事件</p>
      </div>
      <div v-else class="event-list">
        <div v-for="item in recentEvents" :key="item.traceId" class="event-item">
          <div class="event-main">
            <span class="badge" :class="getModuleBadgeClass(item.module)">{{ getModuleLabel(item.module) }}</span>
            <span class="event-detail">{{ item.detail }}</span>
          </div>
          <span class="muted event-time">{{ item.time }}</span>
        </div>
      </div>
      <div class="event-more">
        <RouterLink to="/audit" class="event-more-link">查看更多事件详情 →</RouterLink>
      </div>
    </article>

    <article class="panel">
      <div class="panel-head">
        <h2>全局公告编辑</h2>
      </div>
      <div class="form-row">
        <label class="checkbox-label">
          <input v-model="noticeForm.enabled" type="checkbox" />
          <span>启用全局公告</span>
        </label>
      </div>
      <div class="divider"></div>
      <label class="full-width">
        公告内容
        <textarea v-model="noticeForm.content" rows="6" placeholder="请输入公告内容，支持 HTML 标签"></textarea>
      </label>
      <div v-if="noticeForm.enabled && noticeForm.content" class="notice-preview">
        <h3>预览</h3>
        <div class="notice-box" v-html="noticeForm.content"></div>
      </div>
      <div class="actions">
        <button class="primary" @click="submitGlobalNotice">保存配置</button>
      </div>
    </article>
  </section>

  <ActionDialog
    :open="noticeDialog.open"
    :title="noticeDialogTitle"
    description="公告发布后会进入首页轮巡展示，内容尽量精简。"
    :confirm-text="noticeDialogConfirmText"
    :loading="dialogLoading"
    :confirm-disabled="!noticeForm.title.trim() || !noticeForm.content.trim()"
    @close="noticeDialog.open = false"
    @confirm="submitNoticeDialog"
  >
    <div class="dialog-grid">
      <label>
        公告标题
        <input v-model="noticeForm.title" maxlength="40" placeholder="请输入公告标题" />
      </label>
      <label>
        公告内容
        <textarea v-model="noticeForm.content" maxlength="200" placeholder="请输入公告内容" />
      </label>
    </div>
  </ActionDialog>

  <ActionDialog
    :open="deleteDialog.open"
    title="删除公告"
    description="删除后该条本地公告会从首页轮巡列表中移除。"
    confirm-text="确认删除"
    :loading="dialogLoading"
    danger
    @close="deleteDialog.open = false"
    @confirm="submitDeleteNoticeDialog"
  >
    <p class="dialog-tip">确认删除公告「{{ deleteDialog.title || '未命名公告' }}」吗？</p>
  </ActionDialog>

</template>

<style scoped>
.notice-title {
  max-width: 168px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.search-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  width: fit-content;
}
.search-btn {
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  white-space: nowrap;
  width: auto;
}
.event-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 6px;
}
.event-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.event-detail {
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.event-time {
  font-size: 13px;
  white-space: nowrap;
}
.empty-state {
  padding: 24px;
  text-align: center;
}
.event-more {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}
.event-more-link {
  color: var(--primary, #0b7285);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.event-more-link:hover {
  text-decoration: underline;
}
.notice-preview {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 6px;
}
.notice-preview h3 {
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--text-muted, #6b7280);
}
.notice-box {
  padding: 12px;
  background: #fff;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
}
.full-width {
  grid-column: 1 / -1;
}
.divider {
  height: 1px;
  background: #e5e7eb;
  margin: 12px 0;
}
.checkbox-label {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
  width: fit-content;
}
.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>
