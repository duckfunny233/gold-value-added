<script setup>
import { onMounted, reactive, ref } from 'vue'
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
const loading = ref(false)
const error = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getLeaderboard(filters)
    rows.value = data.rows || []
    monitors.value = data.monitors || []
  } catch (err) {
    error.value = err.message || '排行榜数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="排行榜治理" description="完成排行榜重排、规则校验、同步监控和异常处理。" />

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
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '校验规则' }}</button>
      <button>更新排序规则</button>
      <button>重建排行榜</button>
      <button>导出</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
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
          </tr>
        </tbody>
      </table>
    </article>

    <aside class="stack">
      <article class="panel">
        <div class="panel-head">
          <h2>同步监控</h2>
          <span class="muted">重排与异常处理状态</span>
        </div>
        <div class="kv-list">
          <div class="kv-item" v-for="item in monitors" :key="item.key">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </div>
        </div>
        <div class="actions">
          <button class="primary">处理异常</button>
        </div>
      </article>
    </aside>
  </section>
</template>
