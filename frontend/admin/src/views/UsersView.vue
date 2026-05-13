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
  activeDetailTab.value = 'overview'
  phoneVerifyDialog.verified = false
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
            <td>{{ row.userStatus }}</td>
            <td>
              <div class="cell-actions">
                <button
                  v-if="row.userStatus !== '冻结'"
                  class="warn"
                  type="button"
                  @click.stop="openFreezeDialog(row)"
                >
                  冻结
                </button>
                <button
                  v-else
                  type="button"
                  @click.stop="openFreezeDialog(row)"
                >
                  解冻
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="12" class="table-empty">暂无符合条件的用户</td>
          </tr>
        </tbody>
      </table>
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
    </ul>
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
</style>
