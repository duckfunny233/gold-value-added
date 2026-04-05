<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  reportType: 'operate',
  timeRange: '7d',
  uid: '',
  channel: '',
})

useQueryFilters(filters, ['reportType', 'timeRange', 'uid', 'channel'])

const cards = ref([])
const exportsList = ref([])
const loading = ref(false)
const error = ref('')

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getReports(filters)
    cards.value = data.cards || []
    exportsList.value = data.exportsList || []
  } catch (err) {
    error.value = err.message || '报表数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="报表中心" description="生成多模块运营报表、自定义报表和可视化统计。" />

  <section class="panel">
    <div class="form-row">
      <label>
        报表类型
        <select v-model="filters.reportType">
          <option value="operate">运营</option>
          <option value="finance">财务</option>
          <option value="risk">风控</option>
        </select>
      </label>
      <label>
        时间范围
        <select v-model="filters.timeRange">
          <option value="7d">最近7天</option>
          <option value="30d">最近30天</option>
        </select>
      </label>
      <label>用户UID<input v-model="filters.uid" placeholder="请输入用户UID" /></label>
      <label>
        支付渠道
        <select v-model="filters.channel">
          <option value="">全部</option>
          <option value="wechat">微信</option>
          <option value="alipay">支付宝</option>
          <option value="bank">银行卡</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '生成报表' }}</button>
      <button>导出 CSV</button>
      <button>导出 Excel</button>
      <button>保存自定义模板</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
  </section>

  <section class="grid-3">
    <article class="chart-box" v-for="item in cards" :key="item.key">
      <strong>{{ item.label }}</strong>
      <div class="stat-value">{{ item.value }}</div>
      <div class="metric-bar"><span :style="{ width: item.rate }"></span></div>
      <p class="note">当前统计进度 {{ item.rate }}</p>
    </article>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>导出列表区</h2>
      <span class="muted">自定义报表需保留模板和生成记录</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>报表名称</th>
          <th>生成时间</th>
          <th>生成人</th>
          <th>汇总规则</th>
          <th>数据来源模块</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in exportsList" :key="row.name">
          <td>{{ row.name }}</td>
          <td>{{ row.generatedAt }}</td>
          <td>{{ row.generatedBy }}</td>
          <td>{{ row.aggregationRule }}</td>
          <td>{{ row.dataSourceModules }}</td>
          <td>{{ row.status }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
