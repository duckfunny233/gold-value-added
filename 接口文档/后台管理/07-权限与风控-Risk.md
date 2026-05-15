# 权限与风控-Risk

## 页面名称与路由
- 页面：权限与风控（Risk）
- 路由：`/risk`

## 功能点列表（页面按钮/动作级）
- 风控数据查询（支持用户UID、角色类型、风险类型、预警级别筛选）
- 查看当前风控规则
- 更新风控规则（提现拦截、单笔/日提现上限、异常交易阈值）
- 规则版本对比
- 规则回滚
- 重大变更二次确认
- 查看管理员列表
- 增加管理员
- 查看风控日志

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取风控数据 | GET | `/api/admin/risk` | 获取风控概览、预警、日志、规则版本 | 是 |
| 获取风控规则 | GET | `/api/admin/risk/rules` | 获取当前风控规则详情 | 是 |
| 更新风控规则 | POST | `/api/admin/risk/rules` | 更新风控规则参数 | 是 |
| 获取预警列表 | GET | `/api/admin/risk/alerts` | 获取风险预警列表 | 是 |
| 冻结用户 | POST | `/api/admin/users/:uid/freeze` | 冻结指定用户（风控侧入口） | 是 |
| 解冻用户 | POST | `/api/admin/users/:uid/unfreeze` | 解冻指定用户（风控侧入口） | 是 |
| 全站停盘 | POST | `/api/admin/trades/pause` | 暂停全站交易（风控侧入口） | 是 |
| 恢复交易 | POST | `/api/admin/trades/resume` | 恢复全站交易（风控侧入口） | 是 |
| 获取管理员列表 | GET | `/api/admin/security/admin-users` | 获取后台管理员账号列表 | 是 |
| 获取角色列表 | GET | `/api/admin/security/roles` | 获取后台角色列表 | 是 |
| 获取权限列表 | GET | `/api/admin/security/permissions` | 获取后台权限列表 | 是 |
| 创建管理员 | POST | `/api/admin/security/admin-users` | 新增管理员账号 | 是 |
| 分配管理员角色 | POST | `/api/admin/security/admin-users/:adminUserId/roles` | 为管理员分配角色 | 是 |
| 分配角色权限 | POST | `/api/admin/security/roles/:roleId/permissions` | 为角色分配权限 | 是 |

## 请求/响应关键字段

### GET /api/admin/risk
- 请求 Query：`uid`、`role`、`riskType`、`warningLevel`、`timeRange`
- 响应：`code`、`message`、`data.roles[]`、`data.warnings[]`、`data.logs[]`、`data.currentRules`、`data.ruleVersions[]`

### GET /api/admin/risk/rules
- 响应：`code`、`message`、`data`

### POST /api/admin/risk/rules
- 请求 Body：`withdrawInterceptEnabled`、`singleWithdrawalLimit`、`dailyWithdrawalLimit`、`abnormalTradeThreshold`、`blacklistUids[]`、`effectiveType`、`effectiveTime`
- 响应：`code`、`message`、`data`

### GET /api/admin/risk/alerts
- 响应：`code`、`message`、`data`

### GET /api/admin/security/admin-users
- 响应：`code`、`message`、`data.rows[]`

### GET /api/admin/security/roles
- 响应：`code`、`message`、`data.rows[]`

### GET /api/admin/security/permissions
- 响应：`code`、`message`、`data.rows[]`

### POST /api/admin/security/admin-users
- 请求 Body：`username`、`password`、`displayName`、`roleId`
- 响应：`code`、`message`、`data`

### POST /api/admin/security/admin-users/:adminUserId/roles
- 请求 Param：`adminUserId`
- 请求 Body：`roleIds[]`
- 响应：`code`、`message`、`data`

### POST /api/admin/security/roles/:roleId/permissions
- 请求 Param：`roleId`
- 请求 Body：`permissionIds[]`
- 响应：`code`、`message`、`data`

## 现状与目标差异
- 风控规则更新支持立即生效或定时生效，重大变更（变动幅度超过30%）需二次确认。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `404`：提示“角色/管理员不存在”
- `500`：提示“服务异常，请稍后重试"
