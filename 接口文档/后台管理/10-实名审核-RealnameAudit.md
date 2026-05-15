# 实名审核-RealnameAudit

## 页面名称与路由
- 页面：实名审核（RealnameAudit）
- 路由：`/realname-audit`

## 功能点列表（页面按钮/动作级）
- 实名审核列表查询（支持用户UID、真实姓名、证件号、审核状态、时间范围筛选）
- 查看实名审核详情
- 通过实名审核
- 拒绝实名审核
- 人工复核
- 查看用户详情

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取实名审核列表 | GET | `/api/admin/realname` | 获取实名审核列表与统计 | 是 |
| 通过实名审核 | POST | `/api/admin/realname/:realnameId/approve` | 通过实名认证审核 | 是 |
| 拒绝实名审核 | POST | `/api/admin/realname/:realnameId/reject` | 拒绝实名认证审核 | 是 |
| 人工复核 | POST | `/api/admin/realname/:realnameId/manual-check` | 对实名认证进行人工复核 | 是 |
| 获取用户详情 | GET | `/api/admin/users` | 获取用户详情（关联用户数据） | 是 |

## 请求/响应关键字段

### GET /api/admin/realname
- 请求 Query：`uid`、`realName`、`idCardNo`、`status`、`timeRange`、`page`、`pageSize`
- 响应：`code`、`message`、`data.stats[]`、`data.rows[]`、`data.total`

### POST /api/admin/realname/:realnameId/approve
- 请求 Param：`realnameId`
- 响应：`code`、`message`、`data`

### POST /api/admin/realname/:realnameId/reject
- 请求 Param：`realnameId`
- 响应：`code`、`message`、`data`

### POST /api/admin/realname/:realnameId/manual-check
- 请求 Param：`realnameId`
- 响应：`code`、`message`、`data`

### GET /api/admin/users
- 请求 Query：`uid`
- 响应：`code`、`message`、`data.rows[]`、`data.selectedUser`

## 现状与目标差异
- 实名审核详情中可查看关联的用户详情，通过 `/api/admin/users` 接口获取。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `404`：提示“实名记录不存在”
- `500`：提示“服务异常，请稍后重试"
