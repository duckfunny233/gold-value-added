import { WITHDRAW_ALERT_STATUS, WITHDRAW_STATUS } from '../constants/status.js'

export const dashboardData = {
  stats: [
    { label: '待审核单据', value: '12笔', note: '提现 9 笔 / 资产调整 3 笔' },
    { label: '冻结用户数', value: '27人', note: '风控与提现双拦截已生效' },
    { label: '黄金参考价', value: '¥563.20/克', note: 'AU9999 最近刷新 09:15' },
    { label: '交易状态', value: '运行中', note: '当前交易时段 09:00 - 21:00' },
  ],
  pendingRows: [
    { id: 'wd_20260405003', module: '资金管理', name: '提现审核', owner: '财务', level: '高', time: '09:23:45' },
    { id: 'risk_20260405008', module: '权限与风控', name: '冻结复核', owner: '风控', level: '中', time: '09:27:10' },
    { id: 'sync_20260405002', module: '排行榜治理', name: '同步补偿', owner: '运营', level: '中', time: '09:31:09' },
  ],
  notices: [
    { id: 'notice_001', title: '系统维护公告', status: '已发布', publishAt: '2026-04-05 08:00', pollingEnabled: '是' },
    { id: 'notice_002', title: '交易时间调整提醒', status: '草稿', publishAt: '-', pollingEnabled: '否' },
  ],
  events: [
    { traceId: 'trc_dep_5521', module: '资金管理', detail: '充值自动到账并写入暂定资产', time: '09:18:54' },
    { traceId: 'trc_buy_9031', module: '交易管理', detail: '买卖撮合同步成功', time: '09:22:05' },
    { traceId: 'trc_chain_7712', module: '审计追溯', detail: '哈希已写入半公开金链', time: '09:27:13' },
  ],
  monitors: [
    { key: 'syncDelay', label: '同步延迟', value: '1.8 秒，处于正常阈值内' },
    { key: 'leaderboardRebuildStatus', label: '排行榜重建状态', value: '最近一次重排成功，版本 v20260405-01' },
    { key: 'paymentReconcileStatus', label: '支付对账状态', value: '微信/支付宝/银行卡对账已完成 96%' },
  ],
  ruleReminders: [
    '公告发布后，前端首页应按轮巡方式自动展示。',
    '系统监控必须覆盖同步延迟、排行榜重排、支付对账。',
    '运行中禁用恢复交易，停盘中禁用再次停盘。',
  ],
}

export const usersData = {
  rows: [
    { userId: 'user_1001', uid: 'U0001001', sequenceNo: 'S00001001', nickname: '金影子A', realNameStatus: '已实名', rechargeStatus: '已充值', withdrawStatus: '可提现', cashAsset: '¥28,000', goldHoldingGrams: '48.55克', totalAsset: '¥31,460', userStatus: '正常' },
    { userId: 'user_1088', uid: 'U0001088', sequenceNo: 'S00001088', nickname: '金影子B', realNameStatus: '待实名', rechargeStatus: '未充值', withdrawStatus: '不可提现', cashAsset: '¥2,400', goldHoldingGrams: '8.12克', totalAsset: '¥2,400', userStatus: '冻结' },
    { userId: 'user_1136', uid: 'U0001136', sequenceNo: 'S00001136', nickname: '金影子136', realNameStatus: '已实名', rechargeStatus: '已充值', withdrawStatus: '可提现', cashAsset: '¥9,860', goldHoldingGrams: '15.27克', totalAsset: '¥18,460', userStatus: '正常' },
  ],
  selectedUser: {
    uid: 'U0001001',
    appreciationIncome: '¥3,460',
    payoutProfileSummary: '银行卡 + 支付宝均已校验',
    riskStatus: '低风险',
    lastTradeAt: '2026-04-05 09:22:05',
    latestTraceId: 'trc_buy_9031',
  },
  relatedRecords: {
    recharge: ['充值订单 re_20260405001', '充值流水 trc_dep_5521', '银行卡到账回单已归档'],
    withdraw: ['提现单 wd_20260405003', '审核日志 trc_wd_1203', '提醒状态：已静音'],
    trade: ['交易单 tr_9031', '同步记录 trc_chain_7712', '成交均价 ¥563.20/克'],
    audit: ['审计轨迹 evt_001', '哈希校验通过', '半公开金链同步完成'],
  },
}

export const fundsData = {
  summaryCards: [
    { label: '自动到账充值', value: '128笔', note: '24 小时内自动入账' },
    { label: '待审核提现', value: '9笔', note: '按提交时间顺序排队' },
    { label: '线下打款处理中', value: '4笔', note: '待确认到账' },
    { label: '资金对账异常', value: '2笔', note: '需要人工复核渠道流水' },
  ],
  rechargeRows: [
    { orderId: 're_20260405001', uid: 'U0001001', nickname: '金影子A', channel: '微信', amount: '¥20,000', status: '已对账', createdAt: '09:18:21', traceId: 'trc_dep_5521' },
    { orderId: 're_20260405008', uid: 'U0001088', nickname: '金影子B', channel: '银行卡', amount: '¥8,000', status: '对账中', createdAt: '09:25:12', traceId: 'trc_dep_5528' },
    { orderId: 're_20260405012', uid: 'U0001136', nickname: '金影子136', channel: '支付宝', amount: '¥12,000', status: '已对账', createdAt: '09:31:18', traceId: 'trc_dep_5532' },
  ],
  withdrawRows: [
    {
      orderId: 'wd_20260405003',
      uid: 'U0001089',
      nickname: '金影子089',
      channel: '银行卡',
      amount: '¥5,000',
      status: WITHDRAW_STATUS.PENDING_REVIEW,
      alertStatus: WITHDRAW_ALERT_STATUS.RINGING,
      createdAt: '09:23:45',
      payout: '招商银行 6225 **** 2881',
      confirmCompletedAt: '',
    },
    {
      orderId: 'wd_20260405006',
      uid: 'U0001136',
      nickname: '金影子136',
      channel: '支付宝',
      amount: '¥1,800',
      status: WITHDRAW_STATUS.TRANSFER_PROCESSING,
      alertStatus: WITHDRAW_ALERT_STATUS.MUTED,
      createdAt: '09:29:20',
      payout: '支付宝收款码已上传',
      confirmCompletedAt: '',
    },
    {
      orderId: 'wd_20260405009',
      uid: 'U0001001',
      nickname: '金影子A',
      channel: '银行卡',
      amount: '¥3,200',
      status: WITHDRAW_STATUS.COMPLETED,
      alertStatus: WITHDRAW_ALERT_STATUS.STOPPED,
      createdAt: '08:56:11',
      payout: '建设银行 6217 **** 1908',
      confirmCompletedAt: '2026-04-05 09:18:26',
    },
  ],
  ledgerRows: [
    { traceId: 'trc_adj_0001', type: '手工转账', target: 'U0001001', amount: '+¥1,200', operator: '财务-王芳', updatedAt: '09:33:10' },
    { traceId: 'trc_adj_0002', type: '补款处理', target: 'U0001088', amount: '+¥300', operator: '财务-王芳', updatedAt: '09:35:44' },
    { traceId: 'trc_adj_0003', type: '资产调整', target: 'U0001136', amount: '-¥80', operator: '管理员-赵晨', updatedAt: '09:36:25' },
  ],
  reconcileItems: [
    '微信：已完成 98%',
    '支付宝：待人工复核 1 笔',
    '银行卡：全部完成',
  ],
}

export const tradesData = {
  stats: [
    { label: '当日成交量', value: '236.85克', note: '买卖数据 1 秒内同步' },
    { label: '成交金额', value: '¥128,600', note: '自动撮合成交总额' },
    { label: '平均成交价', value: '¥563.20/克', note: '行情标的 AU9999' },
    { label: '同步异常', value: '2笔', note: '可重试同步' },
  ],
  trades: [
    { tradeNo: 'tr_9031', tradeType: '买入', uid: 'U0001001', nickname: '金影子A', amount: '¥20,000', grams: '35.51克', status: '成功', syncStatus: '已同步', createdAt: '09:22:05', matchPrice: '¥563.20/克', queuePosition: 1 },
    { tradeNo: 'tr_9038', tradeType: '卖出', uid: 'U0001088', nickname: '金影子B', amount: '¥3,420', grams: '6.07克', status: '成功', syncStatus: '已同步', createdAt: '09:26:12', matchPrice: '¥563.40/克', queuePosition: 2 },
    { tradeNo: 'tr_9044', tradeType: '买入', uid: 'U0001136', nickname: '金影子136', amount: '¥8,600', grams: '15.27克', status: '处理中', syncStatus: '待同步', createdAt: '09:31:09', matchPrice: '¥563.19/克', queuePosition: 3 },
  ],
  controlItems: [
    '撮合规则固定为价格优先、时间优先。',
    '高买先成交，同价按提交时间先后成交。',
    '冻结用户与非交易时间用户都必须被拦截。',
  ],
  monitorCards: [
    { key: 'matchPrice', label: '撮合价格', value: '按价格优先，当前最高买价先成交' },
    { key: 'queuePosition', label: '排队位置', value: '同价订单按提交先后排队' },
    { key: 'blockedReason', label: '拦截原因', value: '非交易时段、冻结用户时写入拦截原因' },
  ],
  sessions: [
    { day: '周一至周五', session: '09:00 - 11:30 / 13:30 - 21:00', status: '生效中' },
    { day: '周六', session: '09:00 - 12:00', status: '备用配置' },
  ],
}

export const leaderboardData = {
  rows: [
    { rank: 1, uid: 'U0001001', nickname: '金影子A', goldHoldingGrams: '48.55克', totalAsset: '¥31,460', syncStatus: '已同步', updatedAt: '09:31:10' },
    { rank: 2, uid: 'U0001088', nickname: '金影子B', goldHoldingGrams: '48.55克', totalAsset: '¥30,980', syncStatus: '已同步', updatedAt: '09:31:10' },
    { rank: 3, uid: 'U0001136', nickname: '金影子136', goldHoldingGrams: '15.27克', totalAsset: '¥8,600', syncStatus: '异常', updatedAt: '09:31:09' },
  ],
  monitors: [
    { key: 'sortRule', label: '排序规则', value: '当前使用黄金克数排序' },
    { key: 'rebuildVersion', label: '重建版本', value: 'lb-20260405-01' },
    { key: 'lastSyncAt', label: '最近同步时间', value: '2026-04-05 09:31:10' },
    { key: 'exceptionReason', label: '异常原因', value: '1 笔买入后同步延迟' },
  ],
}

export const riskData = {
  roles: [
    { role: '平台管理员', permission: '全模块管理', status: '已启用' },
    { role: '风控', permission: '冻结/停盘/预警', status: '已启用' },
    { role: '审计', permission: '只读追溯与校验', status: '已启用' },
  ],
  riskRows: [
    { uid: 'U0001088', nickname: '金影子B', userStatus: '冻结', riskType: '提现拦截', operator: '风控-陈璐', updatedAt: '09:23:45' },
    { uid: 'U0001136', nickname: '金影子136', userStatus: '正常', riskType: '同步异常', operator: '运营-沈哲', updatedAt: '09:31:09' },
  ],
  warnings: [
    '冻结用户必须被交易管理和提现流程同时拦截。',
    '角色权限变更必须即时生效并记录日志。',
    '已停盘状态禁用再次停盘。',
  ],
  logs: [
    { action: '分配角色', operator: '管理员-赵晨', result: '成功', traceId: 'trc_role_001', time: '09:11:25' },
    { action: '冻结用户', operator: '风控-陈璐', result: '成功', traceId: 'trc_freeze_008', time: '09:23:45' },
    { action: '全站停盘', operator: '管理员-赵晨', result: '未执行', traceId: 'trc_pause_002', time: '09:34:00' },
  ],
  tradingFlowLabel: '全站状态 运行中 -> 已停盘 -> 运行中',
}

export const auditData = {
  rows: [
    { traceId: 'trc_dep_5521', module: '资金管理', eventType: '充值自动到账', uid: 'U0001001', bizOrderId: 're_20260405001', hashValue: 'a61b...9d2c', createdAt: '09:18:54' },
    { traceId: 'trc_buy_9031', module: '交易管理', eventType: '买卖撮合成功', uid: 'U0001001', bizOrderId: 'tr_9031', hashValue: 'c82f...7f44', createdAt: '09:22:05' },
    { traceId: 'trc_chain_7712', module: '审计追溯', eventType: '金链同步完成', uid: 'U0001001', bizOrderId: 'chain_0001', hashValue: 'f0aa...d521', createdAt: '09:27:13' },
  ],
  detailItems: [
    { key: 'beforeData', label: '变更前数据', value: '充值前总资产 ¥11,460' },
    { key: 'afterData', label: '变更后数据', value: '充值后总资产 ¥31,460' },
    { key: 'operator', label: '操作人', value: '系统 / 财务-王芳' },
    { key: 'hashAlgorithm', label: '哈希算法', value: 'SHA-256 (64 位)' },
    { key: 'chainSyncStatus', label: '金链同步状态', value: '已写入半公开金链' },
  ],
}

export const reportsData = {
  cards: [
    { key: 'userGrowth', label: '用户增长数', value: '318', rate: '62%' },
    { key: 'tradeVolume', label: '成交总克数', value: '1,286克', rate: '74%' },
    { key: 'tradeAmount', label: '成交总金额', value: '¥686,000', rate: '81%' },
    { key: 'fundFlowAmount', label: '资金流水金额', value: '¥1,102,000', rate: '69%' },
    { key: 'withdrawAuditCount', label: '提现审核笔数', value: '129', rate: '53%' },
    { key: 'syncExceptionCount', label: '同步异常笔数', value: '6', rate: '18%' },
  ],
  exportsList: [
    { name: '运营周报', generatedAt: '2026-04-05 09:40', generatedBy: '运营-沈哲', aggregationRule: '按周汇总', dataSourceModules: '用户/交易/资金', status: '已完成' },
    { name: '财务日报', generatedAt: '2026-04-05 09:38', generatedBy: '财务-王芳', aggregationRule: '按日汇总', dataSourceModules: '资金/审计', status: '已完成' },
    { name: '风控追踪表', generatedAt: '2026-04-05 09:36', generatedBy: '风控-陈璐', aggregationRule: '按事件汇总', dataSourceModules: '风控/交易', status: '生成中' },
  ],
}
