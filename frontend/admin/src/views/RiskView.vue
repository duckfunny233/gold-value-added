<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'
import { MVP_SHOW_RISK_RULES } from '../constants/mvp-features'

const showRiskRules = MVP_SHOW_RISK_RULES

const filters = reactive({
  uid: '',
  role: '',
  riskType: '',
  warningLevel: '',
  timeRange: 'today',
})

useQueryFilters(filters, ['uid', 'role', 'riskType', 'warningLevel', 'timeRange'])

const roles = ref([])
const adminRoleOptions = ref([])
const adminUsers = ref([])
const warnings = ref([])
const logs = ref([])
const tradingFlowLabel = ref('')
const currentRules = ref({})
const ruleVersions = ref([])
const loading = ref(false)
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')

const ruleDialog = reactive({
  open: false,
  withdrawInterceptEnabled: 'true',
  singleWithdrawalLimit: '50000',
  dailyWithdrawalLimit: '100000',
  abnormalTradeThreshold: '200000',
  effectiveType: 'immediate',
  effectiveTime: '',
})

const compareDialog = reactive({
  open: false,
})

const rollbackDialog = reactive({
  open: false,
  versionId: '',
})

const approveDialog = reactive({
  open: false,
  changes: [],
})

const adminDialog = reactive({
  open: false,
  username: '',
  password: '',
  displayName: '',
  roleId: '',
})

const filteredAdminUsers = computed(() =>
  adminUsers.value.filter((item) => {
    const keyword = filters.uid.trim().toLowerCase()
    const roleText = `${item.roleCodes?.join(' ') || ''} ${item.roleNames?.join(' ') || ''}`.toLowerCase()

    const matchesKeyword =
      !keyword ||
      item.username?.toLowerCase().includes(keyword) ||
      item.displayName?.toLowerCase().includes(keyword)

    const matchesRole =
      !filters.role ||
      (filters.role === 'admin' && /admin|管理员/.test(roleText)) ||
      (filters.role === 'risk' && /risk|风控/.test(roleText)) ||
      (filters.role === 'audit' && /audit|审计/.test(roleText))

    return matchesKeyword && matchesRole
  }),
)

const ruleChanges = computed(() => {
  const changes = []
  const current = currentRules.value || {}
  if (String(ruleDialog.withdrawInterceptEnabled) !== String(current.withdrawInterceptEnabled ?? true)) {
    changes.push({
      field: '提现拦截',
      oldValue: current.withdrawInterceptEnabled ? '开启' : '关闭',
      newValue: ruleDialog.withdrawInterceptEnabled === 'true' ? '开启' : '关闭',
    })
  }
  if (Number(ruleDialog.singleWithdrawalLimit) !== Number(current.singleWithdrawalLimit || 0)) {
    changes.push({
      field: '单笔提现上限',
      oldValue: String(current.singleWithdrawalLimit || 0),
      newValue: ruleDialog.singleWithdrawalLimit,
    })
  }
  if (Number(ruleDialog.dailyWithdrawalLimit) !== Number(current.dailyWithdrawalLimit || 0)) {
    changes.push({
      field: '日提现上限',
      oldValue: String(current.dailyWithdrawalLimit || 0),
      newValue: ruleDialog.dailyWithdrawalLimit,
    })
  }
  if (Number(ruleDialog.abnormalTradeThreshold) !== Number(current.abnormalTradeThreshold || 0)) {
    changes.push({
      field: '异常交易阈值',
      oldValue: String(current.abnormalTradeThreshold || 0),
      newValue: ruleDialog.abnormalTradeThreshold,
    })
  }
  return changes
})

const hasMajorChange = computed(() => {
  return ruleChanges.value.some((c) => {
    if (c.field === '单笔提现上限' || c.field === '日提现上限') {
      const oldVal = Number(c.oldValue)
      const newVal = Number(c.newValue)
      return oldVal > 0 && Math.abs(newVal - oldVal) / oldVal > 0.3
    }
    return false
  })
})

function formatAdminStatus(status) {
  if (status === 'ACTIVE') {
    return '启用'
  }
  if (status === 'FROZEN') {
    return '冻结'
  }
  return status || '-'
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const securityTasks = [
      AdminService.getAdminSecurityRoles().catch(() => ({ rows: [] })),
      AdminService.getAdminSecurityUsers().catch(() => ({ rows: [] })),
    ]
    const [securityRoles, securityUsers, data] = await Promise.all([
      ...securityTasks,
      showRiskRules ? AdminService.getRisk(filters) : Promise.resolve(null),
    ])
    adminRoleOptions.value = securityRoles.rows || []
    adminUsers.value = securityUsers.rows || []
    if (showRiskRules && data) {
      roles.value = data.roles || []
      warnings.value = data.warnings || []
      logs.value = data.logs || []
      currentRules.value = data.currentRules || {}
      ruleVersions.value = data.ruleVersions || []
      tradingFlowLabel.value = data.tradingFlowLabel || ''
    }
  } catch (err) {
    error.value = err.message || '数据加载失败'
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
    error.value = err.message || '风控操作失败'
  } finally {
    dialogLoading.value = false
  }
}

function openRuleDialog() {
  const current = currentRules.value || {}
  ruleDialog.withdrawInterceptEnabled = String(current.withdrawInterceptEnabled ?? true)
  ruleDialog.singleWithdrawalLimit = String(current.singleWithdrawalLimit || 50000)
  ruleDialog.dailyWithdrawalLimit = String(current.dailyWithdrawalLimit || 100000)
  ruleDialog.abnormalTradeThreshold = String(current.abnormalTradeThreshold || 200000)
  ruleDialog.effectiveType = 'immediate'
  ruleDialog.effectiveTime = ''
  ruleDialog.open = true
}

function openCompareDialog() {
  compareDialog.open = true
}

function openRollbackDialog() {
  rollbackDialog.versionId = ruleVersions.value[0]?.versionId || ''
  rollbackDialog.open = true
}

async function submitRollbackDialog() {
  if (!rollbackDialog.versionId) {
    error.value = '请选择要回滚的版本'
    return
  }
  await runAction(
    () => AdminService.updateRiskRules({ rollbackToVersion: rollbackDialog.versionId }),
    `已回滚到版本 ${rollbackDialog.versionId}`,
  )
  rollbackDialog.open = false
}

async function submitRuleDialog() {
  if (hasMajorChange.value) {
    approveDialog.changes = ruleChanges.value
    approveDialog.open = true
    return
  }
  await doUpdateRules()
}

async function doUpdateRules() {
  const payload = {
    withdrawInterceptEnabled: ruleDialog.withdrawInterceptEnabled === 'true',
    singleWithdrawalLimit: Number(ruleDialog.singleWithdrawalLimit),
    dailyWithdrawalLimit: Number(ruleDialog.dailyWithdrawalLimit),
    abnormalTradeThreshold: Number(ruleDialog.abnormalTradeThreshold),
    effectiveType: ruleDialog.effectiveType,
    effectiveTime: ruleDialog.effectiveType === 'scheduled' ? ruleDialog.effectiveTime : undefined,
  }
  await runAction(
    () => AdminService.updateRiskRules(payload),
    ruleDialog.effectiveType === 'scheduled' && ruleDialog.effectiveTime
      ? `风控规则已更新，将于 ${ruleDialog.effectiveTime} 生效`
      : '风控规则已更新并立即生效',
  )
  ruleDialog.open = false
  approveDialog.open = false
}

function openAdminDialog() {
  adminDialog.username = ''
  adminDialog.password = ''
  adminDialog.displayName = ''
  adminDialog.roleId =
    adminRoleOptions.value.find((item) => item.code === 'SUPER_ADMIN')?.roleId ||
    adminRoleOptions.value[0]?.roleId ||
    ''
  adminDialog.open = true
}

async function submitAdminDialog() {
  if (!adminDialog.username.trim() || !adminDialog.password.trim() || !adminDialog.roleId) {
    error.value = '请完整填写管理员账号、密钥和角色'
    return
  }

  const selectedRole = adminRoleOptions.value.find((item) => item.roleId === adminDialog.roleId)
  await runAction(
    () =>
      AdminService.createAdminUser({
        username: adminDialog.username.trim(),
        password: adminDialog.password.trim(),
        displayName: adminDialog.displayName.trim() || adminDialog.username.trim(),
        roleId: adminDialog.roleId,
      }),
    `管理员 ${adminDialog.username.trim()} 已新增，可直接使用该账号登录`,
  )
  adminDialog.open = false
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="权限管理" />

  <section class="panel">
    <div class="form-row">
      <label>账号/显示名<input v-model="filters.uid" placeholder="搜索管理员账号或显示名" /></label>
      <label>
        角色类型
        <select v-model="filters.role">
          <option value="">全部</option>
          <option value="admin">平台管理员</option>
          <option value="risk">风控</option>
          <option value="audit">审计</option>
        </select>
      </label>
      <template v-if="showRiskRules">
        <label>
          风险类型
          <select v-model="filters.riskType">
            <option value="">全部</option>
            <option value="freeze">冻结</option>
            <option value="withdraw">提现拦截</option>
            <option value="warning">风险预警</option>
          </select>
        </label>
        <label>
          预警级别
          <select v-model="filters.warningLevel">
            <option value="">全部</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
      </template>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="openAdminDialog">增加管理员</button>
      <template v-if="showRiskRules">
        <button @click="openRuleDialog">更新风控规则</button>
        <button @click="openRollbackDialog" v-if="ruleVersions.length">规则回滚</button>
      </template>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section v-if="showRiskRules && currentRules && Object.keys(currentRules).length" class="panel">
    <div class="panel-head">
      <h2>当前风控规则</h2>
      <span class="muted">版本 {{ currentRules.versionId || '-' }} | 更新于 {{ currentRules.updatedAt || '-' }}</span>
    </div>
    <div class="kv-list">
      <div class="kv-item"><strong>提现拦截</strong><span>{{ currentRules.withdrawInterceptEnabled ? '开启' : '关闭' }}</span></div>
      <div class="kv-item"><strong>单笔提现上限</strong><span>{{ currentRules.singleWithdrawalLimit }}</span></div>
      <div class="kv-item"><strong>日提现上限</strong><span>{{ currentRules.dailyWithdrawalLimit }}</span></div>
      <div class="kv-item"><strong>异常交易阈值</strong><span>{{ currentRules.abnormalTradeThreshold }}</span></div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>管理员列表</h2>
      <span class="muted">展示后台账号、角色、状态与最近登录时间</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>登录账号</th>
          <th>显示名称</th>
          <th>角色</th>
          <th>权限数</th>
          <th>状态</th>
          <th>最近登录时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in filteredAdminUsers" :key="row.adminUserId">
          <td>{{ row.username }}</td>
          <td>{{ row.displayName || '-' }}</td>
          <td>{{ row.roleNames?.join(' / ') || row.roleCodes?.join(' / ') || '-' }}</td>
          <td>{{ row.permissionCodes?.length || 0 }}</td>
          <td>{{ formatAdminStatus(row.status) }}</td>
          <td>{{ row.lastLoginAt || '-' }}</td>
        </tr>
        <tr v-if="!filteredAdminUsers.length">
          <td colspan="6" class="table-empty">当前筛选条件下暂无管理员账号</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section v-if="showRiskRules" class="panel">
    <div class="panel-head">
      <h2>风控日志</h2>
      <span class="muted">所有规则调整和权限变更必须留痕</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>操作事项</th>
          <th>操作人</th>
          <th>处理结果</th>
          <th>追踪号</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in logs" :key="row.traceId">
          <td>{{ row.action }}</td>
          <td>{{ row.operator }}</td>
          <td>{{ row.result }}</td>
          <td>{{ row.traceId }}</td>
          <td>{{ row.time }}</td>
        </tr>
        <tr v-if="!logs.length">
          <td colspan="5" class="table-empty">暂无风控日志</td>
        </tr>
      </tbody>
    </table>
  </section>

  <template v-if="showRiskRules">
  <ActionDialog
    :open="ruleDialog.open"
    title="更新风控规则"
    description="修改风控规则参数，支持立即生效或定时生效。"
    confirm-text="确认保存"
    :loading="dialogLoading"
    @close="ruleDialog.open = false"
    @confirm="submitRuleDialog"
  >
    <div class="dialog-grid two-col">
      <label>
        提现拦截
        <select v-model="ruleDialog.withdrawInterceptEnabled">
          <option value="true">开启</option>
          <option value="false">关闭</option>
        </select>
      </label>
      <label>
        单笔提现上限
        <input v-model="ruleDialog.singleWithdrawalLimit" placeholder="请输入单笔提现上限" />
      </label>
      <label>
        日提现上限
        <input v-model="ruleDialog.dailyWithdrawalLimit" placeholder="请输入日提现上限" />
      </label>
      <label>
        异常交易阈值
        <input v-model="ruleDialog.abnormalTradeThreshold" placeholder="请输入异常交易阈值" />
      </label>
    </div>
    <div class="form-row" style="margin-top: 12px;">
      <label class="radio-label">
        <input v-model="ruleDialog.effectiveType" type="radio" value="immediate" />
        立即生效
      </label>
      <label class="radio-label">
        <input v-model="ruleDialog.effectiveType" type="radio" value="scheduled" />
        定时生效
      </label>
    </div>
    <label v-if="ruleDialog.effectiveType === 'scheduled'" class="dialog-label">
      生效时间
      <input v-model="ruleDialog.effectiveTime" type="datetime-local" />
    </label>
    <div v-if="ruleChanges.length" class="compare-preview">
      <h3>变更预览</h3>
      <table class="compare-table">
        <thead>
          <tr><th>规则项</th><th>当前值</th><th>新值</th></tr>
        </thead>
        <tbody>
          <tr v-for="change in ruleChanges" :key="change.field">
            <td>{{ change.field }}</td>
            <td class="old-value">{{ change.oldValue }}</td>
            <td class="new-value">{{ change.newValue }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ActionDialog>

  <ActionDialog
    :open="compareDialog.open"
    title="规则版本对比"
    description="当前规则与上一版本对比"
    confirm-text="关闭"
    :cancel-text="''"
    @close="compareDialog.open = false"
    @confirm="compareDialog.open = false"
  >
    <div v-if="ruleVersions.length >= 2" class="compare-preview">
      <table class="compare-table">
        <thead>
          <tr><th>规则项</th><th>上一版本</th><th>当前版本</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>提现拦截</td>
            <td>{{ ruleVersions[1].withdrawInterceptEnabled ? '开启' : '关闭' }}</td>
            <td>{{ currentRules.withdrawInterceptEnabled ? '开启' : '关闭' }}</td>
          </tr>
          <tr>
            <td>单笔提现上限</td>
            <td>{{ ruleVersions[1].singleWithdrawalLimit }}</td>
            <td>{{ currentRules.singleWithdrawalLimit }}</td>
          </tr>
          <tr>
            <td>日提现上限</td>
            <td>{{ ruleVersions[1].dailyWithdrawalLimit }}</td>
            <td>{{ currentRules.dailyWithdrawalLimit }}</td>
          </tr>
          <tr>
            <td>异常交易阈值</td>
            <td>{{ ruleVersions[1].abnormalTradeThreshold }}</td>
            <td>{{ currentRules.abnormalTradeThreshold }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">暂无历史版本可对比</p>
  </ActionDialog>

  <ActionDialog
    :open="rollbackDialog.open"
    title="规则回滚"
    description="选择历史版本进行回滚"
    confirm-text="确认回滚"
    :loading="dialogLoading"
    danger
    @close="rollbackDialog.open = false"
    @confirm="submitRollbackDialog"
  >
    <label class="dialog-label">
      选择版本
      <select v-model="rollbackDialog.versionId">
        <option v-for="v in ruleVersions" :key="v.versionId" :value="v.versionId">
          版本 {{ v.versionId }} - {{ v.updatedAt }}
        </option>
      </select>
    </label>
  </ActionDialog>

  <ActionDialog
    :open="approveDialog.open"
    title="重大规则变更确认"
    description="检测到重大规则变更（变动幅度超过30%），需要二次确认。"
    confirm-text="确认变更"
    :loading="dialogLoading"
    danger
    @close="approveDialog.open = false"
    @confirm="doUpdateRules"
  >
    <div class="compare-preview">
      <table class="compare-table">
        <thead>
          <tr><th>规则项</th><th>当前值</th><th>新值</th></tr>
        </thead>
        <tbody>
          <tr v-for="change in approveDialog.changes" :key="change.field">
            <td>{{ change.field }}</td>
            <td class="old-value">{{ change.oldValue }}</td>
            <td class="new-value">{{ change.newValue }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ActionDialog>
  </template>

  <ActionDialog
    :open="adminDialog.open"
    title="增加管理员"
    description="新增管理员入口已补齐，表单内容按当前后台角色结构精简展示。"
    confirm-text="确认新增"
    :confirm-disabled="!adminDialog.username.trim() || !adminDialog.password.trim() || !adminDialog.roleId"
    :loading="dialogLoading"
    @close="adminDialog.open = false"
    @confirm="submitAdminDialog"
  >
    <div class="dialog-grid two-col">
      <label>
        登录账号
        <input v-model="adminDialog.username" maxlength="30" placeholder="请输入管理员账号" />
      </label>
      <label>
        登录密钥
        <input v-model="adminDialog.password" type="password" maxlength="30" placeholder="请输入管理员密钥" />
      </label>
      <label>
        显示名称
        <input v-model="adminDialog.displayName" maxlength="30" placeholder="请输入显示名称" />
      </label>
      <label>
        角色
        <select v-model="adminDialog.roleId">
          <option v-for="item in adminRoleOptions" :key="item.roleId" :value="item.roleId">
            {{ item.name }}
          </option>
        </select>
      </label>
    </div>
  </ActionDialog>
</template>

<style scoped>
.radio-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}
.radio-label input[type="radio"] {
  width: 16px;
  height: 16px;
}
.dialog-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.dialog-label input,
.dialog-label select {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
.compare-preview {
  margin-top: 16px;
}
.compare-preview h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--text-primary, #111827);
}
.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.compare-table th,
.compare-table td {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e5e7eb);
  text-align: left;
}
.compare-table th {
  background: var(--bg-secondary, #f3f4f6);
  font-weight: 600;
}
.old-value {
  color: var(--text-muted, #6b7280);
  text-decoration: line-through;
}
.new-value {
  color: var(--success, #10b981);
  font-weight: 600;
}
</style>
