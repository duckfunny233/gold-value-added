# 审计追溯-Audit

## 页面名称与路由
- 页面：审计追溯（Audit）
- 路由：`/audit`

## 功能点列表（页面按钮/动作级）
- 审计日志查询（支持操作人、操作类型、操作对象、时间范围筛选）
- 查看审计日志详情
- 导出审计日志
- 生成审计报表
- 查看审计统计

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取审计日志 | GET | `/api/admin/audit-logs` | 获取审计日志列表与统计 | 是 |
| 获取审计统计 | GET | `/api/admin/audit-logs/stats` | 获取审计统计概览 | 是 |
| 导出审计日志 | POST | `/api/admin/audit-logs/export` | 导出审计日志 | 是 |
| 生成报表 | POST | `/api/admin/reports/generate` | 生成审计相关报表 | 是 |

## 请求/响应关键字段

### GET /api/admin/audit-logs
- 请求 Query：`operator`、`action`、`target`、`timeRange`、`page`、`pageSize`
- 响应：`code`、`message`、`data.stats[]`、`data.rows[]`、`data.summary`、`data.total`

### GET /api/admin/audit-logs/stats
- 响应：`code`、`message`、`data`

### POST /api/admin/audit-logs/export
- 请求 Body：`timeRange`、`format`
- 响应：`code`、`message`、`data.jobId`

### POST /api/admin/reports/generate
- 请求 Body：`reportType=audit`、`timeRange`、`format`、`name`
- 响应：`code`、`message`、`data.jobId`

## 现状与目标差异
- 审计日志支持按操作人、操作类型、操作对象等多维度筛选。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `500`：提示“服务异常，请稍后重试"
