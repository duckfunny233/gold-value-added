<script setup>
import { onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
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
const activeDetailTab = ref('overview')
const rows = ref([])
const selectedUser = ref({})
const relatedRecords = ref({ recharge: [], withdraw: [], trade: [], audit: [] })
const selectedUid = ref('')
const loading = ref(false)
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')

const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const pageSizes = [10, 20, 50, 100]

const freezeDialog = reactive({
  open: false,
  uid: '',
  nickname: '',
  action: 'freeze',
})

const phoneVerifyDialog = reactive({
  open: false,
  phone: '',
  code: '',
  verified: false,
})

const kickDeviceDialog = reactive({
  open: false,
  deviceId: '',
  deviceName: '',
})

const resetPasswordDialog = reactive({
  open: false,
  uid: '',
})

useQueryFilters(filters, ['userId', 'uid', 'sequenceNo', 'realNameStatus', 'rechargeStatus', 'withdrawStatus'])

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getUsers({
      ...filters,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    rows.value = data.rows || []
    total.value = data.total || rows.value.length
    selectedUser.value = data.selectedUser || {}
    relatedRecords.value = data.relatedRecords || { recharge: [], withdraw: [], trade: [], audit: [] }
    selectedUid.value = data.selectedUser?.uid || rows.value[0]?.uid || ''
  } catch (err) {
    error.value = err.message || '用户数据加载失败'
  } finally {
    loading.value = false
  }
}

function handlePageChange(page) {
  currentPage.value = page
  loadData()
}

function handlePageSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadData()
}

function truncateId(id) {
  if (!id) return '-'
  return id.length > 10 ? id.slice(0, 10) + '...' : id
}

async function copyUserId(id) {
  try {
    await navigator.clipboard.writeText(id)
    actionMessage.value = '用户ID已复制'
    setTimeout(() => {
      actionMessage.value = ''
    }, 2000)
  } catch (err) {
    error.value = '复制失败'
  }
}

async function selectUser(uid) {
  selectedUid.value = uid
  activeDetailTab.value = 'overview'
  phoneVerifyDialog.verified = false
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getUsers({ uid })
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
  dialogLoading.value = true
  try {
    await handler()
    actionMessage.value = successMessage
    await loadData()
  } catch (err) {
    error.value = err.message || '用户操作失败'
  } finally {
    dialogLoading.value = false
  }
}

async function handleGenerateReport() {
  await runAction(
    () =>
      AdminService.generateReport({
        reportType: 'operate',
        timeRange: filters.timeRange,
        uid: filters.uid,
        format: 'csv',
        name: '用户列表导出',
      }),
    '报表任务已生成，请前往报表中心下载',
  )
}

function openFreezeDialog(row) {
  freezeDialog.uid = row.uid
  freezeDialog.nickname = row.nickname
  freezeDialog.action = row.userStatus === '冻结' ? 'unfreeze' : 'freeze'
  freezeDialog.open = true
}

async function submitFreezeDialog() {
  const handler =
    freezeDialog.action === 'freeze'
      ? () => AdminService.freezeUser(freezeDialog.uid)
      : () => AdminService.unfreezeUser(freezeDialog.uid)

  await runAction(
    handler,
    freezeDialog.action === 'freeze'
      ? `用户 ${freezeDialog.uid} 已冻结`
      : `用户 ${freezeDialog.uid} 已解冻`,
  )
  freezeDialog.open = false
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

function maskIdCard(idCard) {
  if (!idCard || idCard.length < 10) return idCard
  return idCard.slice(0, 4) + '**********' + idCard.slice(-4)
}

function maskBankAccount(account) {
  if (!account || account.length < 8) return account
  return '****' + account.slice(-4)
}

function openPhoneVerify(phone) {
  phoneVerifyDialog.phone = phone
  phoneVerifyDialog.code = ''
  phoneVerifyDialog.open = true
}

function verifyPhoneCode() {
  if (phoneVerifyDialog.code === '123456') {
    phoneVerifyDialog.verified = true
    phoneVerifyDialog.open = false
  } else {
    error.value = '验证码错误，请重试'
  }
}

function openKickDevice(device) {
  kickDeviceDialog.deviceId = device.deviceId
  kickDeviceDialog.deviceName = device.deviceName
  kickDeviceDialog.open = true
}

async function submitKickDevice() {
  await runAction(
    () => AdminService.kickDevice(selectedUser.value.uid, kickDeviceDialog.deviceId),
    `设备 ${kickDeviceDialog.deviceName} 已踢下线`,
  )
  kickDeviceDialog.open = false
}

function openResetPassword(uid) {
  resetPasswordDialog.uid = uid
  resetPasswordDialog.open = true
}

async function submitResetPassword() {
  await runAction(
    () => AdminService.resetUserPassword(resetPasswordDialog.uid),
    `用户 ${resetPasswordDialog.uid} 密码已重置`,
  )
  resetPasswordDialog.open = false
}

async function forceLogout(uid) {
  await runAction(
    () => AdminService.forceLogoutUser(uid),
    `用户 ${uid} 已被强制登出`,
  )
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="用户管理" />

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
      <div class="search-container">
        <button class="primary search-btn" @click="loadData" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          搜索
        </button>
      </div>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button @click="handleGenerateReport" :disabled="loading">生成报表</button>
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
            <th>总资产</th>
            <th>用户状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.userId"
            @click="selectUser(row.uid)"
            :class="{ 'is-selected': selectedUid === row.uid }"
          >
            <td>
              <span :title="row.userId" class="truncated-id">{{ truncateId(row.userId) }}</span>
              <button class="copy-btn" @click.stop="copyUserId(row.userId)" title="复制用户ID">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              </button>
            </td>
            <td>{{ row.uid }}</td>
            <td>{{ row.sequenceNo }}</td>
            <td>{{ row.nickname }}</td>
            <td>{{ row.realNameStatus }}</td>
            <td>{{ row.rechargeStatus }}</td>
            <td>{{ row.withdrawStatus }}</td>
            <td>{{ row.cashAsset }}</td>
            <td>{{ row.totalAsset }}</td>
            <td>{{ row.userStatus }}</td>
            <td class="actions-cell">
              <button
                :class="{ 'warn': row.userStatus !== '冻结' }"
                type="button"
                @click.stop="openFreezeDialog(row)"
              >
                {{ row.userStatus !== '冻结' ? '冻结' : '解冻' }}
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="11" class="table-empty">暂无符合条件的用户</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar">
        <span class="muted">共 {{ total }} 条，每页</span>
        <select v-model="pageSize" @change="handlePageSizeChange(pageSize)" class="page-size-select">
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
        <span class="muted">条，当前第 {{ currentPage }} 页</span>
        <div class="actions compact">
          <button @click="handlePageChange(currentPage - 1)" :disabled="currentPage <= 1">上一页</button>
          <button @click="handlePageChange(currentPage + 1)" :disabled="currentPage >= Math.ceil(total / pageSize) || total === 0">下一页</button>
        </div>
      </div>
    </article>

    <aside class="panel">
      <div class="panel-head">
        <h2>用户详情抽屉</h2>
        <span class="muted">当前选中用户：{{ selectedUser.uid || '-' }}</span>
      </div>
      <div class="tabs compact">
        <button class="tab-btn" :class="{ active: activeDetailTab === 'overview' }" @click="activeDetailTab = 'overview'">概览</button>
        <button class="tab-btn" :class="{ active: activeDetailTab === 'register' }" @click="activeDetailTab = 'register'">注册信息</button>
        <button class="tab-btn" :class="{ active: activeDetailTab === 'realname' }" @click="activeDetailTab = 'realname'">实名信息</button>
        <button class="tab-btn" :class="{ active: activeDetailTab === 'assets' }" @click="activeDetailTab = 'assets'">资产明细</button>
        <button class="tab-btn" :class="{ active: activeDetailTab === 'devices' }" @click="activeDetailTab = 'devices'">登录设备</button>
        <button class="tab-btn" :class="{ active: activeDetailTab === 'logs' }" @click="activeDetailTab = 'logs'">操作记录</button>
        <button class="tab-btn" :class="{ active: activeDetailTab === 'control' }" @click="activeDetailTab = 'control'">账户控制</button>
      </div>

      <div v-if="activeDetailTab === 'overview'" class="kv-list">
        <div class="kv-item"><strong>增值收益</strong><span>{{ selectedUser.appreciationIncome || '-' }}</span></div>
        <div class="kv-item"><strong>收款信息摘要</strong><span>{{ selectedUser.payoutProfileSummary || '-' }}</span></div>
        <div class="kv-item"><strong>风险状态</strong><span>{{ selectedUser.riskStatus || '-' }}</span></div>
        <div class="kv-item"><strong>最近交易时间</strong><span>{{ selectedUser.lastTradeAt || '-' }}</span></div>
        <div class="kv-item"><strong>最近追踪号</strong><span>{{ selectedUser.latestTraceId || '-' }}</span></div>
      </div>

      <div v-if="activeDetailTab === 'register'" class="kv-list">
        <div class="kv-item"><strong>注册时间</strong><span>{{ selectedUser.registeredAt || '-' }}</span></div>
        <div class="kv-item"><strong>注册渠道</strong><span>{{ selectedUser.registerChannel || '-' }}</span></div>
        <div class="kv-item"><strong>注册IP</strong><span>{{ selectedUser.registerIp || '-' }}</span></div>
        <div class="kv-item"><strong>设备型号</strong><span>{{ selectedUser.deviceModel || '-' }}</span></div>
        <div class="kv-item">
          <strong>手机号</strong>
          <span>
            {{ phoneVerifyDialog.verified ? selectedUser.phone : maskPhone(selectedUser.phone) }}
            <button v-if="!phoneVerifyDialog.verified" class="link-btn" type="button" @click="openPhoneVerify(selectedUser.phone)">查看完整</button>
            <span v-else class="badge-success">已验证</span>
          </span>
        </div>
      </div>

      <div v-if="activeDetailTab === 'realname'" class="kv-list">
        <div class="kv-item"><strong>真实姓名</strong><span>{{ selectedUser.realName || '-' }}</span></div>
        <div class="kv-item"><strong>身份证号</strong><span>{{ maskIdCard(selectedUser.idCard) }}</span></div>
        <div class="kv-item"><strong>实名状态</strong><span>{{ selectedUser.realNameStatus || '-' }}</span></div>
        <div class="kv-item"><strong>认证时间</strong><span>{{ selectedUser.realNameVerifiedAt || '-' }}</span></div>
        <div class="kv-item"><strong>收款方式</strong></div>
        <div v-if="selectedUser.payoutMethods?.length" class="payout-methods">
          <div v-for="method in selectedUser.payoutMethods" :key="method.type" class="payout-item">
            <span class="badge">{{ method.type }}</span>
            <span>{{ maskBankAccount(method.account) }}</span>
            <span :class="method.isDefault ? 'badge-success' : 'muted'">{{ method.isDefault ? '默认' : '' }}</span>
          </div>
        </div>
        <div v-else class="muted">未绑定收款方式</div>
        <div class="actions" style="margin-top: 12px;">
          <RouterLink to="/realname-audit" class="primary-btn-link">跳转到实名审核页</RouterLink>
        </div>
      </div>

      <div v-if="activeDetailTab === 'assets'" class="kv-list">
        <div class="kv-item"><strong>可用余额</strong><span>{{ selectedUser.availableBalance || '-' }}</span></div>
        <div class="kv-item"><strong>冻结金额</strong><span>{{ selectedUser.frozenAmount || '-' }}</span></div>
        <div class="kv-item"><strong>持仓市值</strong><span>{{ selectedUser.holdingValue || '-' }}</span></div>
        <div class="kv-item"><strong>累计盈亏</strong><span>{{ selectedUser.totalProfit || '-' }}</span></div>
        <div class="kv-item"><strong>现金资产</strong><span>{{ selectedUser.cashAsset || '-' }}</span></div>
        <div class="kv-item"><strong>持有黄金</strong><span>{{ selectedUser.goldHoldingGrams || '-' }}</span></div>
        <div class="kv-item"><strong>总资产</strong><span>{{ selectedUser.totalAsset || '-' }}</span></div>
      </div>

      <div v-if="activeDetailTab === 'devices'">
        <div v-if="selectedUser.devices?.length" class="device-list">
          <div v-for="device in selectedUser.devices" :key="device.deviceId" class="device-item">
            <div class="device-info">
              <strong>{{ device.deviceName }}</strong>
              <span class="muted">IP: {{ device.ip }}</span>
              <span class="muted">{{ device.lastLoginAt }}</span>
            </div>
            <button class="warn" type="button" @click="openKickDevice(device)">踢下线</button>
          </div>
        </div>
        <div v-else class="muted">暂无登录设备记录</div>
      </div>

      <div v-if="activeDetailTab === 'logs'">
        <ul v-if="selectedUser.operationLogs?.length" class="list-plain">
          <li v-for="log in selectedUser.operationLogs" :key="log.id" class="log-item">
            <span class="muted">{{ log.createdAt }}</span>
            <span>{{ log.action }}</span>
            <span class="muted">{{ log.detail }}</span>
          </li>
        </ul>
        <div v-else class="muted">暂无操作记录</div>
      </div>

      <div v-if="activeDetailTab === 'control'" class="control-panel">
        <div class="kv-list">
          <div class="kv-item"><strong>账户状态</strong><span :class="selectedUser.userStatus === '冻结' ? 'badge-danger' : 'badge-success'">{{ selectedUser.userStatus || '正常' }}</span></div>
        </div>
        <div class="actions" style="margin-top: 12px;">
          <button
            v-if="selectedUser.userStatus !== '冻结'"
            class="warn"
            @click="openFreezeDialog(selectedUser)"
          >
            禁用账户
          </button>
          <button
            v-else
            @click="openFreezeDialog(selectedUser)"
          >
            启用账户
          </button>
          <button @click="openResetPassword(selectedUser.uid)">重置密码</button>
          <button @click="forceLogout(selectedUser.uid)">强制登出</button>
        </div>
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
      <li v-if="!(relatedRecords[activeRecordTab] || []).length" class="muted">暂无记录</li>
    </ul>
    <div class="record-link-bar">
      <RouterLink v-if="activeRecordTab === 'recharge'" to="/funds" class="record-nav-link">查看完整充值记录与对账 →</RouterLink>
      <RouterLink v-else-if="activeRecordTab === 'withdraw'" to="/funds" class="record-nav-link">进入提现审核队列 →</RouterLink>
      <RouterLink v-else-if="activeRecordTab === 'trade'" to="/trades" class="record-nav-link">进入交易管理详情 →</RouterLink>
      <RouterLink v-else-if="activeRecordTab === 'audit'" to="/audit" class="record-nav-link">进入审计追溯详情 →</RouterLink>
    </div>
  </section>

  <ActionDialog
    :open="freezeDialog.open"
    :title="freezeDialog.action === 'freeze' ? '冻结用户' : '解冻用户'"
    :description="freezeDialog.action === 'freeze' ? '冻结后该用户会被交易和提现流程同时拦截。' : '解冻后该用户会恢复正常交易与提现资格。'"
    :confirm-text="freezeDialog.action === 'freeze' ? '确认冻结' : '确认解冻'"
    :loading="dialogLoading"
    :danger="freezeDialog.action === 'freeze'"
    @close="freezeDialog.open = false"
    @confirm="submitFreezeDialog"
  >
    <p class="dialog-tip">
      {{
        freezeDialog.action === 'freeze'
          ? `确认冻结用户 ${freezeDialog.uid}（${freezeDialog.nickname || '未命名用户'}）吗？`
          : `确认解冻用户 ${freezeDialog.uid}（${freezeDialog.nickname || '未命名用户'}）吗？`
      }}
    </p>
  </ActionDialog>

  <ActionDialog
    :open="phoneVerifyDialog.open"
    title="查看完整手机号"
    description="请输入验证码以查看完整手机号"
    confirm-text="验证"
    @close="phoneVerifyDialog.open = false"
    @confirm="verifyPhoneCode"
  >
    <label class="dialog-label">
      验证码
      <input v-model="phoneVerifyDialog.code" placeholder="请输入验证码（演示：123456）" />
    </label>
  </ActionDialog>

  <ActionDialog
    :open="kickDeviceDialog.open"
    title="踢下线"
    description="确认将该设备踢下线？"
    confirm-text="确认踢出"
    :loading="dialogLoading"
    danger
    @close="kickDeviceDialog.open = false"
    @confirm="submitKickDevice"
  >
    <p class="dialog-tip">设备：{{ kickDeviceDialog.deviceName }}</p>
  </ActionDialog>

  <ActionDialog
    :open="resetPasswordDialog.open"
    title="重置密码"
    description="确认重置该用户密码？重置后用户需通过手机号重新设置密码。"
    confirm-text="确认重置"
    :loading="dialogLoading"
    danger
    @close="resetPasswordDialog.open = false"
    @confirm="submitResetPassword"
  >
    <p class="dialog-tip">用户UID：{{ resetPasswordDialog.uid }}</p>
  </ActionDialog>
</template>

<style scoped>
.tabs.compact {
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.tabs.compact .tab-btn {
  padding: 4px 10px;
  font-size: 12px;
}
.link-btn {
  background: none;
  border: none;
  color: var(--primary, #2563eb);
  cursor: pointer;
  font-size: 12px;
  margin-left: 6px;
  padding: 0;
}
.link-btn:hover {
  text-decoration: underline;
}
.payout-methods {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.payout-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}
.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 6px;
}
.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.log-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}
.log-item:last-child {
  border-bottom: none;
}
.control-panel .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dialog-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.dialog-label input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
.primary-btn-link {
  display: inline-block;
  background: var(--primary, #0b7285);
  color: #fff;
  border: 1px solid var(--primary, #0b7285);
  border-radius: 8px;
  padding: 8px 14px;
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
}
.primary-btn-link:hover {
  opacity: 0.9;
}
.record-link-bar {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}
.record-nav-link {
  display: inline-flex;
  align-items: center;
  color: var(--primary, #0b7285);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  gap: 4px;
}
.record-nav-link:hover {
  text-decoration: underline;
}
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
  flex-wrap: nowrap;
}
.page-size-select {
  padding: 4px 6px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 4px;
  font-size: 13px;
  width: 60px;
  min-width: 60px;
  box-sizing: border-box;
}
.pagination-bar .actions.compact button {
  padding: 4px 12px;
  font-size: 13px;
}
.actions-cell {
  white-space: nowrap;
}
.actions-cell button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  font-size: 12px;
  white-space: nowrap;
}
.truncated-id {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}
.copy-btn {
  display: inline;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  vertical-align: text-bottom;
}
.copy-btn:hover {
  color: #111827;
}
.search-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
}
.search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 14px;
  width: auto;
  height: 34px;
  box-sizing: border-box;
  flex-shrink: 0;
}
</style>
