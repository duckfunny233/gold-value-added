# 首页仪表盘-Dashboard

## 页面名称与路由
- 页面：首页仪表盘（Dashboard）
- 路由：`/dashboard`

## 功能点列表（页面按钮/动作级）
- 仪表盘数据查询（支持日期范围、所属模块、严重级别筛选）
- 刷新仪表盘
- 发布公告
- 编辑公告
- 删除公告
- 全局公告配置（启用/禁用、内容编辑）

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取仪表盘数据 | GET | `/api/admin/dashboard` | 获取统计卡片、待处理单据、公告、事件、监控数据 | 是 |
| 发布公告 | POST | `/api/admin/dashboard/notices` | 发布新公告到首页轮巡 | 是 |
| 编辑公告 | PATCH | `/api/admin/dashboard/notices/:noticeId` | 编辑已有本地公告 | 是 |
| 删除公告 | DELETE | `/api/admin/dashboard/notices/:noticeId` | 删除本地公告 | 是 |
| 更新系统配置 | PATCH | `/api/admin/config` | 更新全局公告等系统配置 | 部分实现（前端调用） |

## 请求/响应关键字段

### GET /api/admin/dashboard
- 请求 Query：`date`（today/7d/30d）、`module`（funds/trades/risk/audit）、`severity`（high/medium/low）
- 响应：`code`、`message`、`traceId`、`data.stats[]`、`data.pendingRows[]`、`data.notices[]`、`data.events[]`、`data.monitors[]`、`data.ruleReminders[]`、`data.tradingStatus`

### POST /api/admin/dashboard/notices
- 请求 Body：`title`、`content`、`sortOrder`
- 响应：`code`、`message`、`traceId`、`data`（公告对象）

### PATCH /api/admin/dashboard/notices/:noticeId
- 请求 Param：`noticeId`
- 请求 Body：`title`、`content`、`sortOrder`
- 响应：`code`、`message`、`traceId`、`data`（公告对象）

### DELETE /api/admin/dashboard/notices/:noticeId
- 请求 Param：`noticeId`
- 响应：`code`、`message`、`traceId`、`data`（删除结果）

### PATCH /api/admin/config
- 请求 Body：`globalNotice.enabled`、`globalNotice.content`
- 响应：`code`、`message`、`data`

## 现状与目标差异
- 全局公告配置通过 `/api/admin/config` 更新，需后端支持 `globalNotice` 字段。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `500`：提示“服务异常，请稍后重试"
