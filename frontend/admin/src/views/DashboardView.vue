<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  date: 'today',
  module: '',
  severity: '',
})

useQueryFilters(filters, ['date', 'module', 'severity'])

const stats = ref([])
const pendingRows = ref([])
const notices = ref([])
const events = ref([])
const monitors = ref([])
const ruleReminders = ref([])
const loading = ref(false)
const error = ref('')

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
  } catch (err) {
    error.value = err.message || '仪表盘数据加载失败'
  } finally {
    loading.value = false
  }
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
      <button class="warn">全站停盘</button>
      <button>恢复交易</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
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
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in notices" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.publishAt }}</td>
              <td>{{ item.pollingEnabled }}</td>
            </tr>
          </tbody>
        </table>
        <div class="actions">
          <button class="primary">发布公告</button>
          <button>编辑公告</button>
          <button>删除公告</button>
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
</template>
