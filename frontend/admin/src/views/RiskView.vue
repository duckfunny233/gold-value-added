<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

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
    const [data, securityRoles, securityUsers] = await Promise.all([
      AdminService.getRisk(filters),
      AdminService.getAdminSecurityRoles().catch(() => ({ rows: [] })),
      AdminService.getAdminSecurityUsers().catch(() => ({ rows: [] })),
    ])
    roles.value = data.roles || []
    adminRoleOptions.value = securityRoles.rows || []
    adminUsers.value = securityUsers.rows || []
    warnings.value = data.warnings || []
    logs.value = data.logs || []
  } catch (err) {
    error.value = err.message || '风控数据加载失败'
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
  ruleDialog.open = true
}

function submitRuleDialog() {
  error.value = ''
  actionMessage.value = `已记录风控规则更新申请：单笔 ${ruleDialog.singleWithdrawalLimit} / 单日 ${ruleDialog.dailyWithdrawalLimit} / 阈值 ${ruleDialog.abnormalTradeThreshold}`
  ruleDialog.open = false
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
  <PageHeader title="权限与风控" description="处理账号权限、角色管理、冻结拦截、停盘控制和风险预警。" />

  <section class="panel">
    <div class="form-row">
      <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
      <label>
        角色类型
        <select v-model="filters.role">
          <option value="">全部</option>
          <option value="admin">平台管理员</option>
          <option value="risk">风控</option>
          <option value="audit">审计</option>
        </select>
      </label>
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
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="openAdminDialog">增加管理员</button>
      <button @click="openRuleDialog">更新风控规则</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>管理员权限与角色区</h2>
      <span class="muted">角色权限变更即时生效</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>角色</th>
          <th>权限</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in roles" :key="row.role">
          <td>{{ row.role }}</td>
          <td>{{ row.permission }}</td>
          <td>{{ row.status }}</td>
        </tr>
      </tbody>
    </table>
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

  <section class="panel">
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
      </tbody>
    </table>
  </section>

  <ActionDialog
    :open="ruleDialog.open"
    title="更新风控规则"
    description="根据问题文档，这里先改为页面弹框编辑，不直接触发规则变更接口。"
    confirm-text="确认保存"
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
  </ActionDialog>

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
