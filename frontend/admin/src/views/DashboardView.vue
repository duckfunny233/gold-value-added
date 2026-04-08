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

const systemDialog = reactive({
  open: false,
  action: 'pause',
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

const noticeDialogTitle = computed(() => (noticeDialog.mode === 'edit' ? '编辑公告' : '新增公告'))
const noticeDialogConfirmText = computed(() => (noticeDialog.mode === 'edit' ? '确认编辑' : '确认发布'))
const systemDialogTitle = computed(() => (systemDialog.action === 'pause' ? '全站停盘' : '恢复交易'))

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

function openSystemDialog(action) {
  systemDialog.action = action
  systemDialog.open = true
}

function submitSystemDialog() {
  actionMessage.value =
    systemDialog.action === 'pause'
      ? '已记录全站停盘操作，本期按文档要求仅保留确认弹框，不直接触发停盘接口'
      : '已记录恢复交易操作，本期按文档要求仅保留确认弹框，不直接触发恢复接口'
  error.value = ''
  systemDialog.open = false
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="首页仪表盘" description="承接全局总览、待办提醒、系统监控、事件流、规则提醒和公告轮播管理。" />

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
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '刷新仪表盘' }}</button>
      <button class="warn" @click="openSystemDialog('pause')">全站停盘</button>
      <button @click="openSystemDialog('resume')">恢复交易</button>
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
        <span class="muted">当前无待处理单据时显示空态</span>
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
          <h2>系统监控</h2>
          <span class="muted">覆盖同步延迟、重排与对账</span>
        </div>
        <div class="kv-list">
          <div class="kv-item" v-for="item in monitors" :key="item.key">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>公告管理</h2>
          <span class="muted">发布后首页轮巡展示</span>
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
              <td>{{ item.title }}</td>
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
        <h2>实时事件流</h2>
        <span class="muted">当前无实时事件时显示空态</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>追踪号</th>
            <th>模块</th>
            <th>事件</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in events" :key="item.traceId">
            <td>{{ item.traceId }}</td>
            <td>{{ item.module }}</td>
            <td>{{ item.detail }}</td>
            <td>{{ item.time }}</td>
          </tr>
        </tbody>
      </table>
    </article>

    <article class="panel">
      <div class="panel-head">
        <h2>规则提醒</h2>
        <span class="muted">关键校验同步到各模块</span>
      </div>
      <ul class="list-plain">
        <li v-for="item in ruleReminders" :key="item">{{ item }}</li>
      </ul>
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

  <ActionDialog
    :open="systemDialog.open"
    :title="systemDialogTitle"
    description="根据问题文档，这里先保留页面确认弹框，不直接触发后台停盘状态切换。"
    confirm-text="确认"
    @close="systemDialog.open = false"
    @confirm="submitSystemDialog"
  >
    <p class="dialog-tip">
      {{
        systemDialog.action === 'pause'
          ? '确认记录一次全站停盘操作说明？本次不会直接更改后台交易状态。'
          : '确认记录一次恢复交易操作说明？本次不会直接更改后台交易状态。'
      }}
    </p>
  </ActionDialog>
</template>
