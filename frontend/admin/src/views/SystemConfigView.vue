<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import ActionDialog from '../components/ActionDialog.vue'
import { ConfigService } from '../services/config'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const actionMessage = ref('')
const activeTab = ref('trading')

const config = reactive({
  tradingHours: {
    openTime: '09:00',
    closeTime: '15:30',
    lunchStart: '11:30',
    lunchEnd: '13:30',
    nightOpen: '20:00',
    nightClose: '02:30',
  },
  marketRules: {
    weekendClosed: true,
    holidays: [],
  },
  fees: {
    rechargeRate: 0,
    withdrawRate: 0,
    tradeCommissionRate: 0,
  },
  withdrawRules: {
    minAmount: 100,
    arrivalDescription: 'T+1 工作日到账',
  },
  registerLimits: {
    maxPerIp: 5,
    deviceFingerprintEnabled: true,
  },
  globalNotice: {
    enabled: false,
    content: '',
  },
})

const newHoliday = ref('')
const configLogs = ref([])
const confirmDialog = reactive({
  open: false,
  title: '',
  description: '',
  onConfirm: null,
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await ConfigService.getSystemConfig()
    if (data.tradingHours) Object.assign(config.tradingHours, data.tradingHours)
    if (data.marketRules) Object.assign(config.marketRules, data.marketRules)
    if (data.fees) Object.assign(config.fees, data.fees)
    if (data.withdrawRules) Object.assign(config.withdrawRules, data.withdrawRules)
    if (data.registerLimits) Object.assign(config.registerLimits, data.registerLimits)
    if (data.globalNotice) Object.assign(config.globalNotice, data.globalNotice)
  } catch (err) {
    error.value = err.message || '配置数据加载失败'
  } finally {
    loading.value = false
  }
}

async function loadLogs() {
  try {
    const data = await ConfigService.getConfigLogs()
    configLogs.value = data.rows || []
  } catch {
    configLogs.value = []
  }
}

function addHoliday() {
  if (!newHoliday.value) return
  if (!config.marketRules.holidays.includes(newHoliday.value)) {
    config.marketRules.holidays.push(newHoliday.value)
  }
  newHoliday.value = ''
}

function removeHoliday(index) {
  config.marketRules.holidays.splice(index, 1)
}

function openConfirmDialog(title, description, onConfirm) {
  confirmDialog.title = title
  confirmDialog.description = description
  confirmDialog.onConfirm = onConfirm
  confirmDialog.open = true
}

async function handleSave() {
  saving.value = true
  error.value = ''
  actionMessage.value = ''
  try {
    const { dailyLimit: _dailyLimit, ...safeWithdrawRules } = config.withdrawRules

    await ConfigService.updateSystemConfig({
      tradingHours: { ...config.tradingHours },
      marketRules: { ...config.marketRules },
      fees: { ...config.fees },
      withdrawRules: safeWithdrawRules,
      registerLimits: { ...config.registerLimits },
      globalNotice: { ...config.globalNotice },
    })
    actionMessage.value = '系统配置已保存'
    await loadLogs()
  } catch (err) {
    error.value = err.message || '保存失败'
  } finally {
    saving.value = false
    confirmDialog.open = false
  }
}

function confirmSave() {
  openConfirmDialog(
    '保存配置',
    '确认保存当前系统配置？错误的配置可能影响交易和资金安全。',
    handleSave,
  )
}

onMounted(() => {
  loadData()
  loadLogs()
})
</script>

<template>
  <PageHeader title="系统配置" />

  <section class="panel">
    <div class="tabs">
      <button class="tab-btn" :class="{ active: activeTab === 'trading' }" @click="activeTab = 'trading'">交易时段</button>
      <button class="tab-btn" :class="{ active: activeTab === 'market' }" @click="activeTab = 'market'">休市规则</button>
      <button class="tab-btn" :class="{ active: activeTab === 'fees' }" @click="activeTab = 'fees'">费率配置</button>
      <button class="tab-btn" :class="{ active: activeTab === 'register' }" @click="activeTab = 'register'">注册限制</button>
      <button class="tab-btn" :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">变更日志</button>
    </div>
  </section>

  <section v-if="activeTab === 'trading'" class="panel">
    <div class="panel-head">
      <h2>交易时段配置</h2>
      <span class="muted">设置每日开盘、收盘及午休时段</span>
    </div>
    <div class="form-grid">
      <label>
        开盘时间
        <input v-model="config.tradingHours.openTime" type="time" />
      </label>
      <label>
        收盘时间
        <input v-model="config.tradingHours.closeTime" type="time" />
      </label>
      <label>
        午休开始
        <input v-model="config.tradingHours.lunchStart" type="time" />
      </label>
      <label>
        午休结束
        <input v-model="config.tradingHours.lunchEnd" type="time" />
      </label>
      <label>
        夜盘开盘
        <input v-model="config.tradingHours.nightOpen" type="time" />
      </label>
      <label>
        夜盘收盘
        <input v-model="config.tradingHours.nightClose" type="time" />
      </label>
    </div>
    <div v-if="activeTab === 'trading'" class="actions-bar">
      <p v-if="error" class="login-error">{{ error }}</p>
      <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
      <div class="actions">
        <button class="primary" @click="confirmSave" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
        <button @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '重置' }}</button>
      </div>
    </div>
  </section>

  <section v-if="activeTab === 'market'" class="panel">
    <div class="panel-head">
      <h2>休市规则配置</h2>
      <span class="muted">设置周末休市及节假日休市</span>
    </div>
    <div class="form-row" style="justify-content: flex-start;">
      <label class="checkbox-label">
        <input v-model="config.marketRules.weekendClosed" type="checkbox" />
        <span>周末休市</span>
      </label>
    </div>
    <div class="divider"></div>
    <div class="form-row" style="align-items: flex-end;">
      <label>
        添加节假日
        <input v-model="newHoliday" type="date" />
      </label>
      <button type="button" class="primary add-holiday-btn" @click="addHoliday">添加</button>
    </div>
    <div v-if="config.marketRules.holidays.length" class="tag-list">
      <span v-for="(date, index) in config.marketRules.holidays" :key="date" class="tag">
        {{ date }}
        <button type="button" class="tag-remove" @click="removeHoliday(index)">×</button>
      </span>
    </div>
    <p v-else class="muted">暂无节假日配置</p>
    <div class="actions-bar">
      <p v-if="error" class="login-error">{{ error }}</p>
      <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
      <div class="actions">
        <button class="primary" @click="confirmSave" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
        <button @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '重置' }}</button>
      </div>
    </div>
  </section>

  <section v-if="activeTab === 'fees'" class="panel">
    <div class="panel-head">
      <h2>费率配置</h2>
      <span class="muted">设置充值、提现和交易佣金费率（%）</span>
    </div>
    <div class="form-grid">
      <label>
        充值手续费率 (%)
        <input v-model.number="config.fees.rechargeRate" type="number" min="0" max="100" step="0.01" />
      </label>
      <label>
        提现手续费率 (%)
        <input v-model.number="config.fees.withdrawRate" type="number" min="0" max="100" step="0.01" />
      </label>
      <label>
        交易佣金率 (%)
        <input v-model.number="config.fees.tradeCommissionRate" type="number" min="0" max="100" step="0.01" />
      </label>
    </div>
    <div class="actions-bar">
      <p v-if="error" class="login-error">{{ error }}</p>
      <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
      <div class="actions">
        <button class="primary" @click="confirmSave" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
        <button @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '重置' }}</button>
      </div>
    </div>
  </section>

  <section v-if="activeTab === 'register'" class="panel">
    <div class="panel-head">
      <h2>注册限制</h2>
      <span class="muted">设置同一IP注册上限</span>
    </div>
    <div class="form-grid">
      <label>
        同一IP注册上限
        <input v-model.number="config.registerLimits.maxPerIp" type="number" min="1" step="1" />
      </label>
    </div>
    <div class="actions-bar">
      <p v-if="error" class="login-error">{{ error }}</p>
      <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
      <div class="actions">
        <button class="primary" @click="confirmSave" :disabled="saving">{{ saving ? '保存中...' : '保存配置' }}</button>
        <button @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '重置' }}</button>
      </div>
    </div>
  </section>

  <section v-if="activeTab === 'logs'" class="panel">
    <div class="panel-head">
      <h2>配置变更日志</h2>
      <span class="muted">记录配置修改历史</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>时间</th>
          <th>操作人</th>
          <th>配置项</th>
          <th>旧值</th>
          <th>新值</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in configLogs" :key="log.id">
          <td>{{ log.createdAt }}</td>
          <td>{{ log.operator }}</td>
          <td>{{ log.configKey }}</td>
          <td class="muted">{{ log.oldValue }}</td>
          <td>{{ log.newValue }}</td>
        </tr>
        <tr v-if="!configLogs.length">
          <td colspan="5" class="table-empty">暂无变更记录</td>
        </tr>
      </tbody>
    </table>
  </section>



  <ActionDialog
    :open="confirmDialog.open"
    :title="confirmDialog.title"
    :description="confirmDialog.description"
    confirm-text="确认保存"
    :loading="saving"
    danger
    @close="confirmDialog.open = false"
    @confirm="confirmDialog.onConfirm"
  />
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
.form-grid textarea,
.form-grid select {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
.full-width {
  grid-column: 1 / -1;
}
.checkbox-label {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
  margin: 0;
  padding: 0;
}
.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-secondary, #f3f4f6);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 9999px;
  font-size: 13px;
}
.tag-remove {
  background: none;
  border: none;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}
.tag-remove:hover {
  color: var(--danger, #dc2626);
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
.actions-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.actions-bar .actions {
  justify-content: flex-end;
}
.add-holiday-btn {
  width: 60px;
  height: 34px;
  padding: 0 8px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.divider {
  height: 1px;
  background: var(--border-color, #e5e7eb);
  margin: 16px 0;
}
.hint-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 14px;
  padding: 10px 14px;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 6px;
  font-size: 13px;
}
.inline-link {
  color: var(--primary, #0b7285);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.inline-link:hover {
  opacity: 0.85;
}
</style>
