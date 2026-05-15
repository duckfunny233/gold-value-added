# 资金管理-Funds

## 页面名称与路由
- 页面：资金管理（Funds）
- 路由：`/funds`

## 功能点列表（页面按钮/动作级）
- 订单操作：充值/提现订单查询（支持订单类型、用户UID、支付渠道、状态筛选）
- 充值对账查看、标记对账/异常
- 提现审核：通过、拒绝、标记转账完成、静音提醒
- 批量审核提现
- 手工转账、补款处理、资产调整
- 平台总览：资金概况、用户资产汇总、资金池健康度、渠道分布、异常预警
- 预警阈值设置
- 导出资金数据

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取资金数据 | GET | `/api/admin/funds` | 获取充值/提现订单、资金流水、对账数据 | 是 |
| 获取充值订单 | GET | `/api/admin/funds/recharges` | 获取充值订单列表 | 是 |
| 获取提现订单 | GET | `/api/admin/funds/withdrawals` | 获取提现订单列表 | 是 |
| 手工转账 | POST | `/api/admin/funds/manual-transfer` | 对用户进行手工转账 | 是 |
| 手工调整 | POST | `/api/admin/funds/manual-adjust` | 对用户资产进行手工调整 | 是 |
| 通过提现审核 | POST | `/api/admin/funds/withdrawals/:orderId/approve` | 通过提现订单审核 | 是 |
| 拒绝提现审核 | POST | `/api/admin/funds/withdrawals/:orderId/reject` | 拒绝提现订单 | 是 |
| 确认转账完成 | POST | `/api/admin/funds/withdrawals/:orderId/confirm-completed` | 标记提现转账完成 | 是 |
| 静音提现提醒 | POST | `/api/admin/funds/withdrawals/:orderId/mute-alert` | 静音提现订单提醒 | 是 |
| 获取平台资金概况 | GET | `/api/admin/platform/funds` | 获取平台总充值/提现/余额/冻结金额 | 前端调用（后端待确认） |
| 获取资金流动趋势 | GET | `/api/admin/platform/fund-flow-trend` | 获取充值提现趋势数据 | 前端调用（后端待确认） |
| 获取用户资产汇总 | GET | `/api/admin/platform/user-assets` | 获取平台用户资产汇总 | 前端调用（后端待确认） |
| 获取资金池健康度 | GET | `/api/admin/platform/fund-pool-health` | 获取流动性与风险准备金指标 | 前端调用（后端待确认） |
| 获取渠道分布 | GET | `/api/admin/platform/channel-distribution` | 获取各支付渠道余额占比 | 前端调用（后端待确认） |
| 获取异常预警 | GET | `/api/admin/platform/abnormal-alerts` | 获取大额异动提醒 | 前端调用（后端待确认） |
| 更新预警阈值 | PATCH | `/api/admin/platform/alert-threshold` | 设置大额充值/提现阈值 | 前端调用（后端待确认） |
| 生成报表 | POST | `/api/admin/reports/generate` | 生成资金相关报表 | 是 |
| 导出报表任务 | POST | `/api/admin/reports/jobs/:jobId/export` | 导出报表任务结果 | 是 |

## 请求/响应关键字段

### GET /api/admin/funds
- 请求 Query：`orderType`、`uid`、`channel`、`status`、`timeRange`
- 响应：`code`、`message`、`data.summaryCards[]`、`data.rechargeRows[]`、`data.withdrawRows[]`、`data.ledgerRows[]`、`data.reconcileItems[]`

### POST /api/admin/funds/manual-transfer
- 请求 Header：`Idempotency-Key`
- 请求 Body：`uid`、`amount`、`direction`、`reason`、`clientRequestId`
- 响应：`code`、`message`、`data`

### POST /api/admin/funds/manual-adjust
- 请求 Header：`Idempotency-Key`
- 请求 Body：`uid`、`amount`、`direction`、`reason`、`clientRequestId`
- 响应：`code`、`message`、`data`

### POST /api/admin/funds/withdrawals/:orderId/approve
- 请求 Param：`orderId`
- 响应：`code`、`message`、`data`

### POST /api/admin/funds/withdrawals/:orderId/reject
- 请求 Param：`orderId`
- 响应：`code`、`message`、`data`

### POST /api/admin/funds/withdrawals/:orderId/confirm-completed
- 请求 Param：`orderId`
- 响应：`code`、`message`、`data`

### POST /api/admin/funds/withdrawals/:orderId/mute-alert
- 请求 Param：`orderId`
- 响应：`code`、`message`、`data`

### GET /api/admin/platform/funds
- 响应：`code`、`message`、`data.totalRecharge`、`data.totalWithdraw`、`data.platformBalance`、`data.frozenAmount`

### GET /api/admin/platform/fund-flow-trend
- 响应：`code`、`message`、`data.labels[]`、`data.rechargeData[]`、`data.withdrawData[]`

### GET /api/admin/platform/user-assets
- 响应：`code`、`message`、`data.totalUsers`、`data.totalHoldingValue`、`data.totalAvailableBalance`

### GET /api/admin/platform/fund-pool-health
- 响应：`code`、`message`、`data.liquidityRatio`、`data.riskReserveRatio`、`data.status`

### GET /api/admin/platform/channel-distribution
- 响应：`code`、`message`、`data.channels[]`

### GET /api/admin/platform/abnormal-alerts
- 响应：`code`、`message`、`data.alerts[]`

### PATCH /api/admin/platform/alert-threshold
- 请求 Body：`largeRechargeThreshold`、`largeWithdrawThreshold`、`rapidChangePercent`
- 响应：`code`、`message`、`data`

## 现状与目标差异
- `/api/admin/platform/*` 系列接口在前端 `PlatformService` 中有调用，但在后端源码中未找到对应控制器，可能尚未实现或位于其他服务中。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `409`：提示“操作冲突，可能已处理”
- `500`：提示“服务异常，请稍后重试"
