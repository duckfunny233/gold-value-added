# 交易管理-Trades

## 页面名称与路由

- 页面：交易管理（Trades）
- 路由：`/trades`
- 前端：`frontend/admin/src/views/TradesView.vue`

## 一期功能范围（与页面对齐）

**纳入**

- 买卖订单列表查询（交易号、方向、UID、状态、同步状态、时间范围）
- 行选中查看单笔摘要（页内已有选中态）

**一期不做（UI 可保留组件但非 MVP 验收项）**

- 全站停盘 / 恢复交易
- 上金所时段同步展示区
- 交易同步重试、资产回填
- 生成交易报表

> 一期联调以 **`GET /api/admin/trades`** 列表数据为准；响应中的 `stats`、`sessions`、`syncOverview` 等字段后端仍会返回，前端可不展示。

## 接口清单表

| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取交易列表 | GET | `/api/admin/trades` | 买卖订单、统计、时段等聚合 | 是 |

## 请求/响应关键字段

### GET /api/admin/trades

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `tradeNo` | Query | string | 否 | 交易单号（订单 ID 模糊） |
| `tradeType` | Query | string | 否 | 买入/卖出筛选 |
| `uid` | Query | string | 否 | 用户 UID |
| `status` | Query | string | 否 | 订单状态 |
| `syncStatus` | Query | string | 否 | 哈希同步状态 |
| `timeRange` | Query | string | 否 | `today` / `7d` / `30d` |
| `data.trades[]` | Response | array | 是 | 交易列表（一期核心） |
| `data.trades[].tradeNo` | Response | string | 是 | 交易号 |
| `data.trades[].tradeType` | Response | string | 是 | `买入` / `卖出` |
| `data.trades[].uid` | Response | string | 是 | 用户 UID |
| `data.trades[].amount` | Response | string | 是 | 成交金额 |
| `data.trades[].grams` | Response | string | 是 | 克数 |
| `data.trades[].status` | Response | string | 是 | 订单状态文案 |
| `data.trades[].syncStatus` | Response | string | 是 | 同步状态 |
| `data.trades[].createdAt` | Response | string | 是 | 提交时间 |
| `data.stats[]` | Response | array | 否 | 统计卡片（二期展示） |
| `data.tradingStatus` | Response | string | 否 | `normal` / `paused` |
| `data.sessions[]` | Response | array | 否 | 交易时段（二期） |
| `data.syncOverview` | Response | object | 否 | 同步概览（二期） |

## 端管数据联动（对照客户端）

| 管理端字段 | 客户端对照（`13-交易页`） | 一致性 |
| --- | --- | --- |
| `trades[].tradeNo` | `tradeNo` / `orderId` | ✅ `TradeOrder.id` |
| `trades[].uid` | 下单上下文 `uid` | ✅ |
| `trades[].tradeType` | `buy`/`sell` vs `买入`/`卖出` | ⚠️ 展示不同 |
| 响应 `traceId` | 审计同号 | ✅ |

## 现状与目标差异

- 成交数据需与 C 端 `POST /api/app/trades/buy|sell` 及 `LedgerEntry` 一致；管理端只读不落单。

## 错误码与前端提示建议

- `401` / `403`：鉴权失败
- `500`：服务异常
