# 登录页-Login

## 页面名称与路由

- 页面：管理员登录（Login）
- 路由：`/login`
- 前端：`frontend/admin/src/views/LoginView.vue`

## 一期功能范围

- 管理员账号 + 密钥登录
- 登录成功写入 `admin_token`、`admin_user`、`admin_roles`
- 登录成功跳转 **`/users`**（一期默认首页）
- 已登录访问 `/login` 时重定向至用户管理

## 接口清单表

| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 管理员登录 | POST | `/api/admin/auth/login` | 校验账号密码并返回 token | 是 |
| 获取管理员资料 | GET | `/api/admin/auth/profile` | 获取当前管理员与权限（按需） | 是 |

## 请求/响应关键字段

### POST /api/admin/auth/login

- 请求 Body：`username`、`password`
- 响应：`code`、`message`、`data.token`、`data.adminUser`（含 `username`、`displayName`、`roleCodes`、`permissionCodes`）

### GET /api/admin/auth/profile

- 请求 Header：`Authorization: Bearer <token>`
- 请求 Query：`username`（可选）
- 响应：`data.username`、`data.displayName`、`data.status`、`data.lastLoginAt`、`data.roles[]`、`data.permissions[]`

## 现状与目标差异

- 本页无业务数据读写，仅依赖登录态字段完整性。
- 一期不涉及仪表盘、公告等登录后跳转能力。

## 错误码与前端提示建议

- `401`：提示「账号或密码错误」
- `404`：提示「管理员不存在」
- `500`：提示「服务异常，请稍后重试」
