# 审计追溯-Audit

## 页面名称与路由

- 页面：审计追溯（Audit）
- 路由：`/audit`
- 前端：`frontend/admin/src/views/AuditView.vue`

## 一期功能范围（与页面对齐）

**纳入**

- 审计日志列表检索（追踪号、UID、模块、事件类型、时间范围）
- 点击行或输入 traceId 查看 **链路详情**（含 ledger 节点）

**一期不做（UI 未使用或非 MVP）**

- `POST /api/admin/audit/trace/:traceId/verify-hash` 哈希校验
- `GET /api/admin/audit/trace/:traceId/export` 链路导出
- 按筛选生成审计报表任务

## 接口清单表

| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取审计列表 | GET | `/api/admin/audit` | 审计/后台操作/哈希记录聚合列表 | 是 |
| 获取链路详情 | GET | `/api/admin/audit/trace/:traceId` | 单 trace 全链路节点 | 是 |

## 请求/响应关键字段

### GET /api/admin/audit

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `traceId` | Query | string | 否 | 追踪号模糊 |
| `uid` | Query | string | 否 | 用户 UID |
| `module` | Query | string | 否 | 模块，如 `fund`、`auth` |
| `eventType` | Query | string | 否 | 事件类型筛选 |
| `timeRange` | Query | string | 否 | `today` / `7d` / `30d` |
| `data.rows[]` | Response | array | 是 | 日志列表（前端本地分页） |
| `data.rows[].traceId` | Response | string | 是 | 追踪号 |
| `data.rows[].module` | Response | string | 是 | 模块 |
| `data.rows[].eventType` | Response | string | 是 | 事件类型 |
| `data.rows[].uid` | Response | string | 否 | 关联用户 UID |
| `data.rows[].referenceId` | Response | string | 否 | 业务单号 |
| `data.rows[].hash` | Response | string | 否 | 哈希摘要 |
| `data.rows[].createdAt` | Response | string | 是 | 创建时间 |

### GET /api/admin/audit/trace/:traceId

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `traceId` | Path | string | 是 | 追踪号 |
| `data.summary` | Response | object | 是 | `totalNodes`、`hashCount`、`syncStatus` |
| `data.nodes[]` | Response | array | 是 | 链路节点 |
| `data.nodes[].nodeType` | Response | string | 是 | 如 `audit`、`ledger`、`hash` |
| `data.nodes[].module` | Response | string | 是 | 模块名 |
| `data.nodes[].action` | Response | string | 是 | 动作 |
| `data.nodes[].referenceType` | Response | string | 否 | 关联类型 |
| `data.nodes[].referenceId` | Response | string | 否 | 关联单 ID |
| `data.nodes[].createdAt` | Response | string | 是 | 时间 |

- 前端通过 `AdminService.mapAuditTraceToDetailItems` 转为右侧详情列表展示。

## 端管数据联动（对照客户端）

| 管理端字段 | 客户端对照 | 一致性 |
| --- | --- | --- |
| `rows[].traceId` | 充提/交易响应 `traceId` | ✅ |
| `rows[].hash` | `GET /api/public/gold-chain` → `hashValue` | ✅ `HashRecord.sha256` |
| 链路 `ledger` 节点 | 资金变动落账 | ✅ `LedgerEntry` |

排查：C 端操作记 `traceId` → 本页 / 资金管理流水同号查询。

## 现状与目标差异

- 资金流水页与审计页应能通过 **同一 `traceId`** 串联充值/提现/审核操作。
- 列表默认最多返回近期 100 条审计 + 50 条后台操作日志（后端 `take` 限制），大范围导出需二期报表接口。

## 错误码与前端提示建议

- `401` / `403`：鉴权失败
- `404`：trace 不存在
- `500`：服务异常
