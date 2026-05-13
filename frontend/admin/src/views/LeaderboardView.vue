<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionDialog from '../components/ActionDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  uid: '',
  sortRule: 'goldHoldingGrams',
  syncStatus: '',
  timeRange: 'today',
})

useQueryFilters(filters, ['uid', 'sortRule', 'syncStatus', 'timeRange'])

const rows = ref([])
const monitors = ref([])
const previewRows = ref([])
const currentRules = ref({})
const loading = ref(false)
const dialogLoading = ref(false)
const error = ref('')
const actionMessage = ref('')

const governanceDialog = reactive({
  open: false,
  action: 'validate',
})

const ruleDialog = reactive({
  open: false,
  period: 'daily',
  weightGold: 70,
  weightAsset: 30,
  threshold: 0,
})

const previewDialog = reactive({
  open: false,
})

const cheatDialog = reactive({
  open: false,
  uid: '',
  nickname: '',
  action: 'remove',
})

const governanceDialogTitle = computed(() => {
  if (governanceDialog.action === 'update') {
    return '更新排序规则'
  }
  if (governanceDialog.action === 'rebuild') {
    return '重建排行榜'
  }
  return '校验规则'
})

function escapeCsv(value) {
  const normalized = value == null ? '' : String(value)
  const escaped = normalized.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function downloadCsv(fileName, items) {
  if (!items.length) {
    error.value = '暂无可导出的排行榜数据'
    return
  }
  const headers = Object.keys(items[0])
  const content = [
    headers.join(','),
    ...items.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getLeaderboard(filters)
    rows.value = data.rows || []
    monitors.value = data.monitors || []
    currentRules.value = data.currentRules || {}
  } catch (err) {
    error.value = err.message || '排行榜数据加载失败'
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
    error.value = err.message || '排行榜操作失败'
  } finally {
    dialogLoading.value = false
  }
}

function openGovernanceDialog(action) {
  governanceDialog.action = action
  governanceDialog.open = true
}

async function submitGovernanceDialog() {
  if (governanceDialog.action === 'validate') {
    await loadData()
    actionMessage.value = `已按当前规则 ${filters.sortRule === 'totalAsset' ? '总资产排序' : '黄金克数排序'} 重新校验排行榜数据`
  } else if (governanceDialog.action === 'update') {
    await runAction(
      () => AdminService.updateLeaderboardRules({ sortRule: filters.sortRule }),
      `排序规则已更新为${filters.sortRule === 'totalAsset' ? '总资产排序' : '黄金克数排序'}`,
    )
  } else {
    await runAction(
      () => AdminService.rebuildLeaderboard({ sortRule: filters.sortRule }),
      '排行榜重建任务已触发',
    )
  }
  governanceDialog.open = false
}

function openRuleDialog() {
  const current = currentRules.value || {}
  ruleDialog.period = current.period || 'daily'
  ruleDialog.weightGold = current.weightGold ?? 70
  ruleDialog.weightAsset = current.weightAsset ?? 30
  ruleDialog.threshold = current.threshold ?? 0
  ruleDialog.open = true
}

async function submitRuleDialog() {
  await runAction(
    () =>
      AdminService.updateLeaderboardRules({
        period: ruleDialog.period,
        weightGold: Number(ruleDialog.weightGold),
        weightAsset: Number(ruleDialog.weightAsset),
        threshold: Number(ruleDialog.threshold),
      }),
    '排行榜规则参数已更新',
  )
  ruleDialog.open = false
}

async function loadPreview() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.previewLeaderboard({
      sortRule: filters.sortRule,
      period: ruleDialog.period,
      weightGold: Number(ruleDialog.weightGold),
      weightAsset: Number(ruleDialog.weightAsset),
      threshold: Number(ruleDialog.threshold),
    })
    previewRows.value = data.rows || []
    previewDialog.open = true
  } catch (err) {
    error.value = err.message || '预览加载失败'
  } finally {
    loading.value = false
  }
}

function openCheatDialog(row) {
  cheatDialog.uid = row.uid
  cheatDialog.nickname = row.nickname
  cheatDialog.action = 'remove'
  cheatDialog.open = true
}

async function submitCheatDialog() {
  await runAction(
    () =>
      AdminService.markCheatUser(cheatDialog.uid, {
        action: cheatDialog.action,
      }),
    `用户 ${cheatDialog.nickname || cheatDialog.uid} 已${cheatDialog.action === 'remove' ? '从榜单移除' : '标记异常'}`,
  )
  cheatDialog.open = false
}

function handleExport() {
  downloadCsv(
    `leaderboard-${filters.sortRule}-${Date.now()}.csv`,
    rows.value.map((item) => ({
      rank: item.rank,
      uid: item.uid,
      nickname: item.nickname,
      goldHoldingGrams: item.goldHoldingGrams,
      totalAsset: item.totalAsset,
      syncStatus: item.syncStatus,
      updatedAt: item.updatedAt,
    })),
  )
  actionMessage.value = '排行榜已基于真实查询结果导出'
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="排行榜治理" description="完成排行榜重排、规则校验和同步监控。" />

  <section class="panel">
    <div class="form-row">
      <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
      <label>
        排序规则
        <select v-model="filters.sortRule">
          <option value="goldHoldingGrams">按黄金克数排序</option>
          <option value="totalAsset">按总资产排序</option>
        </select>
      </label>
      <label>
        同步状态
        <select v-model="filters.syncStatus">
          <option value="">全部</option>
          <option value="synced">已同步</option>
          <option value="exception">异常</option>
          <option value="rebuilding">重建中</option>
        </select>
      </label>
      <label>
        时间范围
        <select v-model="filters.timeRange">
          <option value="today">今日</option>
          <option value="7d">最近7天</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="openGovernanceDialog('validate')" :disabled="loading">{{ loading ? '加载中...' : '校验规则' }}</button>
      <button @click="openGovernanceDialog('update')">更新排序规则</button>
      <button @click="openGovernanceDialog('rebuild')">重建排行榜</button>
      <button @click="openRuleDialog">规则配置</button>
      <button @click="handleExport">导出</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-else-if="actionMessage" class="note">{{ actionMessage }}</p>
  </section>

  <section class="panel" v-if="currentRules && Object.keys(currentRules).length">
    <div class="panel-head">
      <h2>当前规则参数</h2>
      <span class="muted">版本 {{ currentRules.versionId || '-' }} | 更新于 {{ currentRules.updatedAt || '-' }}</span>
    </div>
    <div class="kv-list">
      <div class="kv-item"><strong>排行周期</strong><span>{{ currentRules.period === 'weekly' ? '周榜' : currentRules.period === 'monthly' ? '月榜' : '日榜' }}</span></div>
      <div class="kv-item"><strong>黄金权重</strong><span>{{ currentRules.weightGold }}%</span></div>
      <div class="kv-item"><strong>资产权重</strong><span>{{ currentRules.weightAsset }}%</span></div>
      <div class="kv-item"><strong>上榜门槛</strong><span>{{ currentRules.threshold }}</span></div>
    </div>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="panel-head">
        <h2>排行榜列表</h2>
        <span class="muted">支持按黄金克数或总资产进行规则配置</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>用户UID</th>
            <th>昵称</th>
            <th>持有黄金克数</th>
            <th>总资产</th>
            <th>同步状态</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="`${row.rank}-${row.uid}`">
            <td>{{ row.rank }}</td>
            <td>{{ row.uid }}</td>
            <td>{{ row.nickname }}</td>
            <td>{{ row.goldHoldingGrams }}</td>
            <td>{{ row.totalAsset }}</td>
            <td>{{ row.syncStatus }}</td>
            <td>{{ row.updatedAt }}</td>
            <td>
              <div class="cell-actions">
                <button class="warn" type="button" @click.stop="openCheatDialog(row)">标记</button>
              </div>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="8" class="table-empty">暂无排行榜数据</td>
          </tr>
        </tbody>
      </table>
    </article>

    <aside class="stack">
      <article class="panel">
        <div class="panel-head">
          <h2>同步监控</h2>
          <span class="muted">重排状态概览</span>
        </div>
        <div class="kv-list">
          <div class="kv-item" v-for="item in monitors" :key="item.key">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </div>
        </div>
      </article>
    </aside>
  </section>

  <ActionDialog
    :open="governanceDialog.open"
    :title="governanceDialogTitle"
    description="确认执行排行榜治理操作？"
    confirm-text="确认"
    :loading="dialogLoading"
    @close="governanceDialog.open = false"
    @confirm="submitGovernanceDialog"
  >
    <div class="dialog-grid">
      <label>
        当前排序规则
        <select v-model="filters.sortRule">
          <option value="goldHoldingGrams">按黄金克数排序</option>
          <option value="totalAsset">按总资产排序</option>
        </select>
      </label>
      <p class="dialog-tip">
        {{
          governanceDialog.action === 'validate'
            ? '确认后会基于当前筛选条件重新拉取排行榜数据。'
            : governanceDialog.action === 'update'
              ? '确认后会更新排序规则并同步到排行榜。'
              : '确认后会触发排行榜重建任务。'
        }}
      </p>
    </div>
  </ActionDialog>

  <ActionDialog
    :open="ruleDialog.open"
    title="规则参数配置"
    description="配置排行榜周期、权重和上榜门槛"
    confirm-text="保存规则"
    :loading="dialogLoading"
    @close="ruleDialog.open = false"
    @confirm="submitRuleDialog"
  >
    <div class="dialog-grid two-col">
      <label>
        排行周期
        <select v-model="ruleDialog.period">
          <option value="daily">日榜</option>
          <option value="weekly">周榜</option>
          <option value="monthly">月榜</option>
        </select>
      </label>
      <label>
        上榜门槛
        <input v-model.number="ruleDialog.threshold" type="number" min="0" placeholder="最低资产门槛" />
      </label>
      <label>
        黄金权重 (%)
        <input v-model.number="ruleDialog.weightGold" type="number" min="0" max="100" placeholder="黄金克数权重" />
      </label>
      <label>
        资产权重 (%)
        <input v-model.number="ruleDialog.weightAsset" type="number" min="0" max="100" placeholder="总资产权重" />
      </label>
    </div>
    <div class="actions" style="margin-top: 12px;">
      <button type="button" @click="loadPreview">预览效果</button>
    </div>
  </ActionDialog>

  <ActionDialog
    :open="previewDialog.open"
    title="榜单数据预览"
    description="新规则下的榜单预览结果"
    confirm-text="关闭"
    :cancel-text="''"
    @close="previewDialog.open = false"
    @confirm="previewDialog.open = false"
  >
    <table v-if="previewRows.length" class="preview-table">
      <thead>
        <tr>
          <th>排名</th>
          <th>用户UID</th>
          <th>昵称</th>
          <th>得分</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in previewRows" :key="row.uid">
          <td>{{ row.rank }}</td>
          <td>{{ row.uid }}</td>
          <td>{{ row.nickname }}</td>
          <td>{{ row.score }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">暂无预览数据</p>
  </ActionDialog>

  <ActionDialog
    :open="cheatDialog.open"
    title="作弊用户标记"
    description="对异常用户进行榜单处理"
    confirm-text="确认"
    :loading="dialogLoading"
    danger
    @close="cheatDialog.open = false"
    @confirm="submitCheatDialog"
  >
    <div class="dialog-form">
      <p class="dialog-tip">用户：{{ cheatDialog.nickname || cheatDialog.uid }}</p>
      <label>
        处理方式
        <select v-model="cheatDialog.action">
          <option value="remove">从榜单移除</option>
          <option value="mark">标记异常</option>
        </select>
      </label>
    </div>
  </ActionDialog>
</template>

<style scoped>
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
.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-primary, #111827);
}
.dialog-form select {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
</style>
