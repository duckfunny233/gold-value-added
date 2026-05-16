# 资金管理-Funds

## 页面名称与路由

- 页面：资金管理（Funds）
- 路由：`/funds`
- 前端：`frontend/admin/src/views/FundsView.vue`

## 一期功能范围（与页面对齐）

**纳入**

- **订单操作**（默认 Tab）：充值订单列表、提现订单列表、资金流水列表
- 统一筛选：订单类型、用户 UID、支付渠道、订单状态、时间范围
- 提现审核闭环：**通过** → **拒绝** → **标记转账完成**
- 充值订单：列表只读 + 详情弹窗（自动入账以对账状态展示）

**一期不做（UI 已隐藏）**

- 平台总览 Tab（`PlatformService` 图表类接口）
- 手工转账、补款、资产调整
- 渠道对账侧栏
- 导出报表、批量审核、提现静音提醒

## 接口清单表

| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取资金聚合数据 | GET | `/api/admin/funds` | 充值/提现/流水/摘要卡片 | 是 |
| 获取充值订单 | GET | `/api/admin/funds/recharges` | 仅充值列表（可选拆分） | 是 |
| 获取提现订单 | GET | `/api/admin/funds/withdrawals` | 仅提现列表（可选拆分） | 是 |
| 通过提现审核 | POST | `/api/admin/funds/withdrawals/:orderId/approve` | 待审核 → 审核中 | 是 |
| 拒绝提现 | POST | `/api/admin/funds/withdrawals/:orderId/reject` | 拒绝提现单 | 是 |
| 确认转账完成 | POST | `/api/admin/funds/withdrawals/:orderId/confirm-completed` | 标记提现完成 | 是 |
| 标记充值对账/异常 | — | — | 前端按钮存在，**服务层未封装/后端无独立接口** | 否 |

## 请求/响应关键字段

### GET /api/admin/funds

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `orderType` | Query | string | 否 | `recharge` / `withdraw`，空为全部 |
| `uid` | Query | string | 否 | 用户 UID |
| `channel` | Query | string | 否 | `wechat` / `alipay` / `bank` |
| `status` | Query | string | 否 | 充值：`reconciling`/`reconciled`；提现：待审核等映射见后端 |
| `timeRange` | Query | string | 否 | `today` / `7d` / `30d` |
| `data.summaryCards[]` | Response | array | 是 | 顶部统计卡片 |
| `data.rechargeRows[]` | Response | array | 是 | 充值订单 |
| `data.rechargeRows[].orderId` | Response | string | 是 | 订单号 |
| `data.rechargeRows[].uid` | Response | string | 是 | 用户 UID |
| `data.rechargeRows[].amount` | Response | string/number | 是 | 金额 |
| `data.rechargeRows[].status` | Response | string | 是 | 如「对账中」「已对账」 |
| `data.rechargeRows[].channel` | Response | string | 是 | 支付渠道展示 |
| `data.withdrawRows[]` | Response | array | 是 | 提现订单（按 queueNo 排序） |
| `data.withdrawRows[].orderId` | Response | string | 是 | 订单号 |
| `data.withdrawRows[].status` | Response | string | 是 | 审核/转账状态文案 |
| `data.withdrawRows[].payout` | Response | string | 否 | 收款账户摘要 |
| `data.ledgerRows[]` | Response | array | 是 | 资金流水（`LedgerEntry`） |
| `data.ledgerRows[].traceId` | Response | string | 是 | 追踪号 |
| `data.ledgerRows[].type` | Response | string | 是 | 变动类型 |
| `data.ledgerRows[].target` | Response | string | 是 | 目标用户 UID |
| `data.ledgerRows[].amount` | Response | string | 是 | 变动金额（含正负展示） |
| `data.ledgerRows[].operator` | Response | string | 否 | 操作人 |
| `data.ledgerRows[].updatedAt` | Response | string | 是 | 时间 |

### POST /api/admin/funds/withdrawals/:orderId/approve

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `orderId` | Path | string | 是 | 提现订单 ID |
| `Authorization` | Header | string | 是 | 管理员 token |

- 成功：订单由 `PENDING` 进入 `REVIEWING`，写入审计与 hash 记录。

### POST /api/admin/funds/withdrawals/:orderId/reject

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `orderId` | Path | string | 是 | 提现订单 ID |

> 前端拒绝弹窗会填写原因，当前 `AdminService.rejectWithdrawal` **未传 Body**；二期建议增加 `reason` 字段落库。

### POST /api/admin/funds/withdrawals/:orderId/confirm-completed

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `orderId` | Path | string | 是 | 提现订单 ID |

- 成功：完成提现并写 `LedgerEntry`（资金出账类流水）。

## 端管数据联动（对照客户端）

| 管理端字段 | 客户端对照 | 一致性 |
| --- | --- | --- |
| `rechargeRows[].orderId` | `POST /api/wallet/recharge`、`.../confirm` | ✅ `RechargeOrder.id` |
| `rechargeRows[].traceId` | 充提响应 `traceId` | ✅ |
| `withdrawRows[].orderId` | `POST /api/wallet/withdraw` | ✅ |
| `withdrawRows[].status` | `GET /api/app/withdrawals` | ✅ 机器码 `pending_review` 等，见 [00§2.5](../后台管理一期/00-后台管理一期共用接口汇总.md) |
| `ledgerRows[].traceId` | 金链/审计同源 | ✅ |

## 现状与目标差异

- 充值「对账 / 异常」按钮调用 `AdminService.updateRechargeStatus`，**该方法尚未在 `admin.js` 实现**，一期仅展示状态，勿依赖按钮落库。
- 流水数据来自 `LedgerEntry` 表，验收需保证充值完成、提现完成、买卖成交均有落账。

## 错误码与前端提示建议

- `401` / `403`：登录或权限问题
- `404`：订单不存在
- `409`：订单已被处理（重复审核）
- `500`：服务异常
