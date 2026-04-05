<script setup>
import { onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useQueryFilters } from '../composables/useQueryFilters'
import { AdminService } from '../services/admin'

const filters = reactive({
  orderType: '',
  uid: '',
  channel: '',
  status: '',
  timeRange: 'today',
})

const activeTab = ref('recharge')
const summaryCards = ref([])
const rechargeRows = ref([])
const withdrawRows = ref([])
const ledgerRows = ref([])
const reconcileItems = ref([])
const loading = ref(false)
const error = ref('')

useQueryFilters(filters, ['orderType', 'uid', 'channel', 'status', 'timeRange'])

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await AdminService.getFunds(filters)
    summaryCards.value = data.summaryCards || []
    rechargeRows.value = data.rechargeRows || []
    withdrawRows.value = data.withdrawRows || []
    ledgerRows.value = data.ledgerRows || []
    reconcileItems.value = data.reconcileItems || []
  } catch (err) {
    error.value = err.message || '资金数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <PageHeader title="资金管理" description="处理充值对账、提现审核、补款转账、资产调整和支付渠道对账。" />

  <section class="panel">
    <div class="form-row">
      <label>
        订单类型
        <select v-model="filters.orderType">
          <option value="">全部</option>
          <option value="recharge">充值订单</option>
          <option value="withdraw">提现订单</option>
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
      <label>
        订单状态
        <select v-model="filters.status">
          <option value="">全部</option>
          <option value="reconciling">对账中</option>
          <option value="reconciled">已对账</option>
          <option value="pending_review">待审核</option>
          <option value="approved">已通过</option>
          <option value="paid">已到账</option>
        </select>
      </label>
    </div>
    <div class="actions">
      <button class="primary" @click="loadData" :disabled="loading">{{ loading ? '加载中...' : '查询' }}</button>
      <button>导出</button>
    </div>
    <p v-if="error" class="login-error">{{ error }}</p>
  </section>

  <section class="grid-4">
    <article class="stat-card" v-for="card in summaryCards" :key="card.label">
      <p class="stat-label">{{ card.label }}</p>
      <p class="stat-value">{{ card.value }}</p>
      <p class="note">{{ card.note }}</p>
    </article>
  </section>

  <section class="split-main-aside">
    <article class="panel">
      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'recharge' }" @click="activeTab = 'recharge'">充值订单</button>
        <button class="tab-btn" :class="{ active: activeTab === 'withdraw' }" @click="activeTab = 'withdraw'">提现订单</button>
      </div>

      <div v-if="activeTab === 'recharge'">
        <div class="panel-head">
          <h2>充值对账查看</h2>
          <span class="muted">24 小时自动到账，无人工审核按钮</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>用户UID</th>
              <th>昵称</th>
              <th>支付渠道</th>
              <th>金额</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>追踪号</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rechargeRows" :key="row.orderId">
              <td>{{ row.orderId }}</td>
              <td>{{ row.uid }}</td>
              <td>{{ row.nickname }}</td>
              <td>{{ row.channel }}</td>
              <td>{{ row.amount }}</td>
              <td>{{ row.status }}</td>
              <td>{{ row.createdAt }}</td>
              <td>{{ row.traceId }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else>
        <div class="panel-head">
          <h2>提现审核队列</h2>
          <span class="muted">按提交时间顺序排队，需展示收款信息</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>用户UID</th>
              <th>昵称</th>
              <th>支付渠道</th>
              <th>金额</th>
              <th>审核状态</th>
              <th>到账状态</th>
              <th>收款信息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in withdrawRows" :key="row.orderId">
              <td>{{ row.orderId }}</td>
              <td>{{ row.uid }}</td>
              <td>{{ row.nickname }}</td>
              <td>{{ row.channel }}</td>
              <td>{{ row.amount }}</td>
              <td>{{ row.status }}</td>
              <td>{{ row.paidStatus }}</td>
              <td>{{ row.payout }}</td>
            </tr>
          </tbody>
        </table>
        <div class="actions">
          <button class="primary">通过提现</button>
          <button class="warn">拒绝提现</button>
          <button>确认到账</button>
        </div>
      </div>
    </article>

    <aside class="stack">
      <article class="panel">
        <div class="panel-head">
          <h2>补款与资产调整</h2>
          <span class="muted">变更必须写入审计日志</span>
        </div>
        <div class="kv-list">
          <div class="kv-item"><strong>手工转账</strong><span>对用户进行手工转账，实时到账/减账</span></div>
          <div class="kv-item"><strong>补款处理</strong><span>异常补款处理，要求记录追踪号</span></div>
          <div class="kv-item"><strong>资产调整</strong><span>手工资产调整，需保留操作人和原因</span></div>
        </div>
        <div class="actions">
          <button class="primary">手工转账</button>
          <button>补款处理</button>
          <button>资产调整</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>渠道对账</h2>
          <span class="muted">覆盖微信、支付宝、银行卡</span>
        </div>
        <ul class="list-plain">
          <li v-for="item in reconcileItems" :key="item">{{ item }}</li>
        </ul>
      </article>
    </aside>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>资金流水审计</h2>
      <span class="muted">展示手工转账、补款、资产调整等操作记录</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>追踪号</th>
          <th>操作类型</th>
          <th>目标用户</th>
          <th>金额</th>
          <th>操作人</th>
          <th>更新时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in ledgerRows" :key="row.traceId">
          <td>{{ row.traceId }}</td>
          <td>{{ row.type }}</td>
          <td>{{ row.target }}</td>
          <td>{{ row.amount }}</td>
          <td>{{ row.operator }}</td>
          <td>{{ row.updatedAt }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
