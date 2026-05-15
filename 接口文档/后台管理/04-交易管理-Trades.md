# 交易管理-Trades

## 页面名称与路由
- 页面：交易管理（Trades）
- 路由：`/trades`

## 功能点列表（页面按钮/动作级）
- 交易列表查询（支持交易号、交易类型、用户UID、交易状态、同步状态、时间范围筛选）
- 刷新交易状态
- 全站停盘
- 恢复交易
- 交易同步重试
- 生成交易报表

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取交易列表 | GET | `/api/admin/trades` | 获取交易列表、统计卡片、同步状态 | 是 |
| 获取交易概览 | GET | `/api/admin/trades/overview` | 获取交易概览数据 | 是 |
| 获取交易时段状态 | GET | `/api/admin/trades/session-status` | 获取上金所交易时段同步状态 | 是 |
| 全站停盘 | POST | `/api/admin/trades/pause` | 暂停全站交易 | 是 |
| 恢复交易 | POST | `/api/admin/trades/resume` | 恢复全站交易 | 是 |
| 重试同步 | POST | `/api/admin/trades/retry-sync` | 重试交易同步 | 是 |
| 资产回填 | POST | `/api/admin/trades/backfill-assets` | 后台资产回填 | 是 |
| 生成报表 | POST | `/api/admin/reports/generate` | 生成交易相关报表 | 是 |

## 请求/响应关键字段

### GET /api/admin/trades
- 请求 Query：`tradeNo`、`tradeType`、`uid`、`status`、`syncStatus`、`timeRange`
- 响应：`code`、`message`、`data.stats[]`、`data.trades[]`、`data.controlItems[]`、`data.monitorCards[]`、`data.sessions[]`、`data.syncOverview`、`data.tradingStatus`

### GET /api/admin/trades/overview
- 响应：`code`、`message`、`data`

### GET /api/admin/trades/session-status
- 响应：`code`、`message`、`data`

### POST /api/admin/trades/pause
- 响应：`code`、`message`、`data`

### POST /api/admin/trades/resume
- 响应：`code`、`message`、`data`

### POST /api/admin/trades/retry-sync
- 请求 Body：`tradeNo`
- 响应：`code`、`message`、`data`

### POST /api/admin/trades/backfill-assets
- 请求 Body：`uid`
- 响应：`code`、`message`、`data`

### POST /api/admin/reports/generate
- 请求 Body：`reportType=finance`、`timeRange`、`uid`、`format`、`name`
- 响应：`code`、`message`、`data.jobId`

## 现状与目标差异
- 交易时段同步状态为只读展示，前端不支持手动修改交易时段。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `500`：提示“服务异常，请稍后重试"
