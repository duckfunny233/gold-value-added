# 权限管理-Risk

## 页面名称与路由

- 页面：权限管理（一期裁剪自原「权限与风控」）
- 路由：`/risk`
- 前端：`frontend/admin/src/views/RiskView.vue`

## 一期功能范围（与页面对齐）

**纳入**

- 管理员列表查询（账号/显示名、角色类型筛选）
- **新增管理员**（账号、初始密钥、显示名、角色）
- 角色下拉数据来自角色列表接口

**一期不做（`MVP_SHOW_RISK_RULES = false`，UI 已隐藏）**

- `GET /api/admin/risk` 风控聚合
- 更新风控规则、规则回滚、风控日志
- `GET /api/admin/risk/rules`、`POST /api/admin/risk/rules`
- 角色权限分配（`POST .../roles/:roleId/permissions`）— 页面未暴露入口

## 接口清单表

| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取管理员列表 | GET | `/api/admin/security/admin-users` | 后台账号列表 | 是 |
| 获取角色列表 | GET | `/api/admin/security/roles` | 新增管理员时角色下拉 | 是 |
| 新增管理员 | POST | `/api/admin/security/admin-users` | 创建子账户 | 是 |
| 分配管理员角色 | POST | `/api/admin/security/admin-users/:adminUserId/roles` | 调整角色（一期未用） | 是 |
| 获取权限清单 | GET | `/api/admin/security/permissions` | 权限树（一期未用） | 是 |

## 请求/响应关键字段

### GET /api/admin/security/admin-users

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `Authorization` | Header | string | 是 | 需 `SECURITY_READ` 等权限 |
| `data.rows[]` | Response | array | 是 | 管理员列表 |
| `data.rows[].adminUserId` | Response | string | 是 | 管理员 ID |
| `data.rows[].username` | Response | string | 是 | 登录账号 |
| `data.rows[].displayName` | Response | string | 否 | 显示名称 |
| `data.rows[].roleCodes` | Response | array | 否 | 角色编码 |
| `data.rows[].roleNames` | Response | array | 否 | 角色名称 |
| `data.rows[].permissionCodes` | Response | array | 否 | 权限码列表 |
| `data.rows[].status` | Response | string | 是 | `ACTIVE` 等 |
| `data.rows[].lastLoginAt` | Response | string | 否 | 最近登录 |

### GET /api/admin/security/roles

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `data.rows[].roleId` | Response | string | 是 | 角色 ID |
| `data.rows[].code` | Response | string | 是 | 角色编码 |
| `data.rows[].name` | Response | string | 是 | 角色名称 |

### POST /api/admin/security/admin-users

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `username` | Body | string | 是 | 登录账号 |
| `password` | Body | string | 是 | 初始密钥，≥6 位 |
| `displayName` | Body | string | 是 | 显示名称 |
| `roleId` | Body | string | 是 | 绑定角色 ID |

- 创建成功后子账户可使用该账号登录 `POST /api/admin/auth/login`。

### POST /api/admin/security/admin-users/:adminUserId/roles

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `adminUserId` | Path | string | 是 | 管理员 ID |
| `roleIds` | Body | string[] | 是 | 角色 ID 列表 |

## 现状与目标差异

- 一期页面标题为「权限管理」，不再调用 `GET /api/admin/risk`。
- 冻结 C 端用户仍在 **用户管理** 页，接口为 `/api/admin/users/:uid/freeze`，非本页。

## 错误码与前端提示建议

- `401` / `403`：无权限（如缺少 `SECURITY_ASSIGN_ROLES`）
- `409`：账号已存在
- `400`：参数校验失败
- `500`：服务异常
