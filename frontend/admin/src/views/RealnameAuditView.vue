<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import ActionDialog from '../components/ActionDialog.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { RealnameService } from '../services/realname'

const filters = reactive({
  status: '',
  keyword: '',
  startTime: '',
  endTime: '',
  operator: '',
})

useQueryFilters(filters, ['status', 'keyword', 'startTime', 'endTime', 'operator'])

const rows = ref([])
const auditLogs = ref([])
const selectedRow = ref({})
const loading = ref(false)
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')
const imagePreviewOpen = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

const pageSize = 10
const currentPage = ref(1)
const totalCount = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))

const auditDrawer = reactive({
  open: false,
  id: '',
  realName: '',
  action: 'approve',
  remark: '',
})

const statusMap = {
  pending: '待审核',
  passed: '已通过',
  rejected: '已拒绝',
}

const statusClassMap = {
  pending: 'badge-warn',
  passed: 'badge-success',
  rejected: 'badge-danger',
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await RealnameService.getRealnameList({
      ...filters,
      page: currentPage.value,
      pageSize,
    })
    rows.value = data.rows || []
    totalCount.value = data.total || rows.value.length
    if (!rows.value.find((r) => r.id === selectedRow.value?.id)) {
      selectedRow.value = rows.value[0] || {}
    }
  } catch (err) {
    error.value = err.message || '实名认证数据加载失败'
  } finally {
    loading.value = false
  }
}

async function loadAuditLogs() {
  try {
    const data = await RealnameService.getAuditLogs({
      realnameId: selectedRow.value?.id,
      startTime: filters.startTime,
      endTime: filters.endTime,
      operator: filters.operator,
    })
    auditLogs.value = data.rows || []
  } catch (err) {
    auditLogs.value = []
  }
}

function selectRow(row) {
  selectedRow.value = row
  loadAuditLogs()
}

function goToPage(page) {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
  loadData()
}

function openImagePreview(url, title) {
  previewImageUrl.value = url
  previewImageTitle.value = title
  imagePreviewOpen.value = true
}

function openAuditDrawer(row, action) {
  auditDrawer.id = row.id
  auditDrawer.realName = row.realName
  auditDrawer.action = action
  auditDrawer.remark = ''
  auditDrawer.open = true
}

async function submitAudit() {
  dialogLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await RealnameService.manualCheck(auditDrawer.id, {
      action: auditDrawer.action,
      remark: auditDrawer.remark,
    })
    actionMessage.value = `用户 ${auditDrawer.realName || auditDrawer.id} 已${auditDrawer.action === 'approve' ? '通过' : '拒绝'}`
    auditDrawer.open = false
    await loadData()
    await loadAuditLogs()
  } catch (err) {
    error.value = err.message || '审核操作失败'
  } finally {
    dialogLoading.value = false
  }
}

async function handleBatchAudit(action) {
  const pendingRows = rows.value.filter((r) => r.status === 'pending')
  if (!pendingRows.length) {
    error.value = '没有待审核的记录'
    return
  }
  dialogLoading.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    await Promise.all(pendingRows.map((row) => RealnameService.manualCheck(row.id, { action, remark: '批量审核' })))
    actionMessage.value = `批量${action === 'approve' ? '通过' : '拒绝'}完成，共 ${pendingRows.length} 条`
    await loadData()
    await loadAuditLogs()
  } catch (err) {
    error.value = err.message || '批量审核失败'
  } finally {
    dialogLoading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <PageHeader title="实名认证审核" description="管理用户实名认证信息，完成人工审核与记录追溯。" />

  <section class="panel">
    <div class="form-row">
      <label>
        审核状态
        <select v-model="filters.status">
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="passed">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </label>
      <label>
        搜索
        <input v-model="filters.keyword" placeholder="用户ID / 姓名 / 身份证号" />
      </label>
      <label>
        开始时间
        <input v-model="filters.startTime" type="date" />
      </label>
      <label>
        结束时间
        <input v-model="filters.endTime" type="date" />
      </label>
      <label>
        操作人
        <input v-model="filters.operator" placeholder="请输入操作人" />
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="handleBatchAudit('approve')" :disabled="loading">批量通过</button>
      <button class="warn" @click="handleBatchAudit('reject')" :disabled="loading">批量拒绝</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>实名认证列表</h2>
        <span class="muted">共 {{ totalCount }} 条记录</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>用户ID</th>
            <th>真实姓名</th>
            <th>身份证号</th>
            <th>提交时间</th>
            <th>审核状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            @click="selectRow(row)"
            :class="{ 'is-selected': selectedRow?.id === row.id }"
          >
            <td>{{ row.userId }}</td>
            <td>{{ row.realName }}</td>
            <td>{{ row.idCard }}</td>
            <td>{{ row.submittedAt }}</td>
            <td>
              <span class="badge" :class="statusClassMap[row.status] || ''">{{ statusMap[row.status] || row.status }}</span>
            </td>
            <td>
              <div class="cell-actions">
                <button
                  v-if="row.status === 'pending'"
                  class="primary"
                  type="button"
                  @click.stop="openAuditDrawer(row, 'approve')"
                >
                  通过
                </button>
                <button
                  v-if="row.status === 'pending'"
                  class="warn"
                  type="button"
                  @click.stop="openAuditDrawer(row, 'reject')"
                >
                  拒绝
                </button>
                <span v-else class="muted">已处理</span>
              </div>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="table-empty">暂无符合条件的实名认证记录</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar">
        <span class="muted">共 {{ totalCount }} 条，当前第 {{ currentPage }} / {{ totalPages }} 页，每页 {{ pageSize }} 条</span>
        <div class="actions compact">
          <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">上一页</button>
          <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">下一页</button>
        </div>
      </div>
    </article>

    <aside class="panel">
      <div class="panel-head">
        <h2>认证详情</h2>
        <span class="muted">当前选中：{{ selectedRow?.userId || '-' }}</span>
      </div>
      <div class="kv-list">
        <div class="kv-item"><strong>用户ID</strong><span>{{ selectedRow.userId || '-' }}</span></div>
        <div class="kv-item"><strong>真实姓名</strong><span>{{ selectedRow.realName || '-' }}</span></div>
        <div class="kv-item"><strong>身份证号</strong><span>{{ selectedRow.idCard || '-' }}</span></div>
        <div class="kv-item"><strong>手机号</strong><span>{{ maskPhone(selectedRow.phone) || '-' }}</span></div>
        <div class="kv-item"><strong>注册时间</strong><span>{{ selectedRow.registeredAt || '-' }}</span></div>
        <div class="kv-item"><strong>注册渠道</strong><span>{{ selectedRow.channel || '-' }}</span></div>
        <div class="kv-item"><strong>提交时间</strong><span>{{ selectedRow.submittedAt || '-' }}</span></div>
        <div class="kv-item"><strong>审核状态</strong><span>{{ statusMap[selectedRow.status] || selectedRow.status || '-' }}</span></div>
      </div>

      <div v-if="selectedRow.idCardFront || selectedRow.idCardBack" class="idcard-preview">
        <h3>身份证照片</h3>
        <div class="idcard-images">
          <div v-if="selectedRow.idCardFront" class="idcard-thumb" @click="openImagePreview(selectedRow.idCardFront, '身份证正面')">
            <img :src="selectedRow.idCardFront" alt="身份证正面" />
            <span>正面</span>
          </div>
          <div v-if="selectedRow.idCardBack" class="idcard-thumb" @click="openImagePreview(selectedRow.idCardBack, '身份证反面')">
            <img :src="selectedRow.idCardBack" alt="身份证反面" />
            <span>反面</span>
          </div>
        </div>
      </div>

      <div v-if="auditLogs.length" class="audit-log">
        <h3>审核记录</h3>
        <ul class="list-plain">
          <li v-for="log in auditLogs" :key="log.id">
            <span class="muted">{{ log.createdAt }}</span>
            <span :class="log.action === 'approve' ? 'badge-success' : 'badge-danger'">{{ log.action === 'approve' ? '通过' : '拒绝' }}</span>
            <span v-if="log.operator">操作人：{{ log.operator }}</span>
            <span v-if="log.remark" class="muted">备注：{{ log.remark }}</span>
          </li>
        </ul>
      </div>
    </aside>
  </section>

  <ActionDialog
    :open="auditDrawer.open"
    :title="auditDrawer.action === 'approve' ? '通过实名认证' : '拒绝实名认证'"
    :description="auditDrawer.action === 'approve' ? '确认通过该用户的实名认证申请？' : '确认拒绝该用户的实名认证申请？'"
    :confirm-text="auditDrawer.action === 'approve' ? '确认通过' : '确认拒绝'"
    :loading="dialogLoading"
    :danger="auditDrawer.action === 'reject'"
    @close="auditDrawer.open = false"
    @confirm="submitAudit"
  >
    <div class="dialog-form">
      <p class="dialog-tip">用户：{{ auditDrawer.realName || auditDrawer.id }}</p>
      <label>
        审核备注
        <textarea v-model="auditDrawer.remark" rows="3" placeholder="请输入审核备注（可选）"></textarea>
      </label>
    </div>
  </ActionDialog>

  <div v-if="imagePreviewOpen" class="dialog-backdrop" @click="imagePreviewOpen = false">
    <section class="dialog image-preview-dialog" role="dialog" aria-modal="true" :aria-label="previewImageTitle" @click.stop>
      <header class="dialog-head">
        <h2>{{ previewImageTitle }}</h2>
      </header>
      <div class="dialog-body image-preview-body">
        <img :src="previewImageUrl" :alt="previewImageTitle" />
      </div>
      <footer class="dialog-actions">
        <button type="button" @click="imagePreviewOpen = false">关闭</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.idcard-preview {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}
.idcard-preview h3 {
  font-size: 14px;
  margin-bottom: 10px;
  color: var(--text-primary, #111827);
}
.idcard-images {
  display: flex;
  gap: 12px;
}
.idcard-thumb {
  width: 120px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-color, #e5e7eb);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f3f4f6);
}
.idcard-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.idcard-thumb span {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 12px;
  text-align: center;
  padding: 2px 0;
}
.audit-log {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}
.audit-log h3 {
  font-size: 14px;
  margin-bottom: 10px;
  color: var(--text-primary, #111827);
}
.audit-log li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}
.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.dialog-form textarea {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
}
.image-preview-body {
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-preview-body img {
  max-width: 100%;
  max-height: 60vh;
  border-radius: 6px;
}
</style>
