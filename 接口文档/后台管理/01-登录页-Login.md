# 登录页-Login

## 页面名称与路由
- 页面：管理员登录页（Login）
- 路由：`/login`

## 功能点列表（页面按钮/动作级）
- 管理员账号密码登录
- 登录成功后写入 token、admin_user、admin_roles 到 localStorage
- 登录失败提示错误信息
- 已登录状态下访问登录页自动跳转到仪表盘

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 管理员登录 | POST | `/api/admin/auth/login` | 校验管理员账号密码并返回登录态 | 是 |
| 获取管理员资料 | GET | `/api/admin/auth/profile` | 获取当前登录管理员资料与权限 | 是 |

## 请求/响应关键字段

### POST /api/admin/auth/login
- 请求：`username`、`password`
- 响应：`code`、`message`、`data.token`、`data.adminUser.username`、`data.adminUser.displayName`、`data.adminUser.roleCodes`、`data.adminUser.permissionCodes`

### GET /api/admin/auth/profile
- 请求 Header：`Authorization: Bearer <token>`
- 响应：`code`、`message`、`data.username`、`data.displayName`、`data.status`、`data.lastLoginAt`、`data.roles`、`data.permissions`

## 现状与目标差异
- 本页无直接业务数据操作，仅依赖登录态字段完整性。

## 错误码与前端提示建议
- `401`：提示“账号或密码错误”
- `404`：提示“管理员不存在”
- `500`：提示“服务异常，请稍后重试”
