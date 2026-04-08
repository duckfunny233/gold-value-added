<script setup>
import { onMounted, reactive, ref } from 'vue'
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
const riskRows = ref([])
const warnings = ref([])
const logs = ref([])
const tradingFlowLabel = ref('')
const selectedUid = ref('')
const loading = ref(false)
const error = ref('')
const actionMessage = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getRisk(filters)
    roles.value = data.roles || []
    riskRows.value = data.riskRows || []
    warnings.value = data.warnings || []
    logs.value = data.logs || []
    tradingFlowLabel.value = data.tradingFlowLabel || ''
    selectedUid.value = riskRows.value[0]?.uid || filters.uid || ''
  } catch (err) {
    error.value = err.message || '风控数据加载失败'
  } finally {
    loading.value = false
  }
}

function currentUid() {
  return selectedUid.value || filters.uid
}

async function runAction(handler, successMessage) {
  error.value = ''
  actionMessage.value = ''
  try {
    await handler()
    actionMessage.value = successMessage
    await loadData()
  } catch (err) {
    error.value = err.message || '风控操作失败'
  }
}

async function handleFreezeUser() {
  const uid = currentUid()
  if (!uid) {
    error.value = '请先输入或选中用户 UID'
    return
  }
  await runAction(() => AdminService.freezeUser(uid), `用户 ${uid} 已冻结`)
}

async function handleUnfreezeUser() {
  const uid = currentUid()
  if (!uid) {
    error.value = '请先输入或选中用户 UID'
    return
  }
  await runAction(() => AdminService.unfreezeUser(uid), `用户 ${uid} 已解冻`)
}

async function handlePauseTrading() {
  await runAction(() => AdminService.pauseTrading(), '全站停盘已执行')
}

async function handleResumeTrading() {
  await runAction(() => AdminService.resumeTrading(), '交易已恢复')
}

async function handleUpdateRules() {
  try {
    const currentRules = await AdminService.getRiskRules()
    const withdrawInterceptEnabled =
      window.prompt(
        '提现拦截开关 true/false',
        currentRules.withdrawInterceptEnabled ? 'true' : 'false',
      ) || ''
    const singleWithdrawalLimit = window.prompt(
      '单笔提现上限',
      String(currentRules.singleWithdrawalLimit ?? 0),
    )
    const dailyWithdrawalLimit = window.prompt(
      '日提现上限',
      String(currentRules.dailyWithdrawalLimit ?? 0),
    )
    const abnormalTradeThreshold = window.prompt(
      '异常交易阈值',
      String(currentRules.abnormalTradeThreshold ?? 0),
    )
    const blacklistUids = window.prompt(
      '黑名单 UID，多个用英文逗号分隔',
      (currentRules.blacklistUids || []).join(','),
    )

    if (
      withdrawInterceptEnabled === '' ||
      singleWithdrawalLimit === null ||
      dailyWithdrawalLimit === null ||
      abnormalTradeThreshold === null ||
      blacklistUids === null
    ) {
      return
    }

    await runAction(
      () =>
        AdminService.updateRiskRules({
          withdrawInterceptEnabled: withdrawInterceptEnabled === 'true',
          singleWithdrawalLimit: Number(singleWithdrawalLimit),
          dailyWithdrawalLimit: Number(dailyWithdrawalLimit),
          abnormalTradeThreshold: Number(abnormalTradeThreshold),
          blacklistUids: blacklistUids
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      '风控规则与黑名单已更新',
    )
  } catch (err) {
    error.value = err.message || '风控规则加载失败'
  }
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
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '分配角色' }}</button>
      <button class="warn" @click="handleFreezeUser">冻结用户</button>
      <button @click="handleUnfreezeUser">解冻用户</button>
      <button @click="handleUpdateRules">更新风控规则</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="split-main-aside">
    <article class="panel">
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
    </article>

    <aside class="stack">
      <article class="panel">
        <div class="panel-head">
          <h2>全站停盘与预警区</h2>
          <span class="muted">{{ tradingFlowLabel }}</span>
        </div>
        <div class="actions compact">
          <button class="warn" @click="handlePauseTrading">全站停盘</button>
          <button @click="handleResumeTrading">恢复交易</button>
        </div>
        <ul class="list-plain">
          <li v-for="item in warnings" :key="item">{{ item }}</li>
        </ul>
      </article>
    </aside>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>用户冻结与拦截区</h2>
      <span class="muted">暂无风险事件时显示空态</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>用户UID</th>
          <th>昵称</th>
          <th>用户状态</th>
          <th>风险类型</th>
          <th>操作人</th>
          <th>更新时间</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in riskRows"
          :key="`${row.uid}-${row.updatedAt}`"
          @click="selectedUid = row.uid"
          :class="{ 'is-selected': selectedUid === row.uid }"
        >
          <td>{{ row.uid }}</td>
          <td>{{ row.nickname }}</td>
          <td>{{ row.userStatus }}</td>
          <td>{{ row.riskType }}</td>
          <td>{{ row.operator }}</td>
          <td>{{ row.updatedAt }}</td>
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
</template>
