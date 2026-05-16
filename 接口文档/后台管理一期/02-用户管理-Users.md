# 用户管理-Users

## 页面名称与路由

- 页面：用户管理（Users）
- 路由：`/users`
- 前端：`frontend/admin/src/views/UsersView.vue`

## 一期功能范围（与页面对齐）

**纳入**

- 用户列表分页查询（UID、用户 ID、注册序号、实名状态等筛选）
- 用户详情：概览、注册信息、实名信息（只读）、资产明细
- 关联记录摘要（充值/提现/交易/审计各若干条，只读）
- **冻结 / 解冻**账户

**一期不做（UI 已隐藏或未对接）**

- 踢下线设备、强制登出、重置密码
- 手机号验证码查看明文
- 生成用户报表（`POST /api/admin/reports/generate`）
- 人工复核（`manual-check`）
- 跳转实名审核台

## 接口清单表

| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取用户列表与详情 | GET | `/api/admin/users` | 列表、选中用户详情、关联记录 | 是 |
| 冻结用户 | POST | `/api/admin/users/:uid/freeze` | 冻结账号（禁止交易、提现） | 是 |
| 解冻用户 | POST | `/api/admin/users/:uid/unfreeze` | 解冻账号 | 是 |

## 请求/响应关键字段

### GET /api/admin/users

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `userId` | Query | string | 否 | 用户内部 ID 模糊 |
| `uid` | Query | string | 否 | 用户 UID；传则优先匹配详情 |
| `sequenceNo` | Query | string | 否 | 注册序号 |
| `realNameStatus` | Query | string | 否 | 实名状态筛选 |
| `rechargeStatus` | Query | string | 否 | 充值状态筛选 |
| `withdrawStatus` | Query | string | 否 | 提现能力筛选 |
| `page` | Query | number | 否 | 页码，默认 1 |
| `pageSize` | Query | number | 否 | 每页条数，默认 10 |
| `data.rows[]` | Response | array | 是 | 列表行 |
| `data.rows[].uid` | Response | string | 是 | 用户 UID |
| `data.rows[].nickname` | Response | string | 是 | 昵称 |
| `data.rows[].realNameStatus` | Response | string | 是 | 实名状态文案 |
| `data.rows[].cashAsset` | Response | string | 是 | 现金资产展示 |
| `data.rows[].totalAsset` | Response | string | 是 | 总资产展示 |
| `data.rows[].userStatus` | Response | string | 是 | 账户状态（含冻结） |
| `data.total` | Response | number | 是 | 总条数 |
| `data.selectedUser` | Response | object | 否 | 当前选中用户详情摘要 |
| `data.relatedRecords` | Response | object | 否 | `recharge`/`withdraw`/`trade`/`audit` 字符串摘要数组 |

### POST /api/admin/users/:uid/freeze

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `uid` | Path | string | 是 | 目标用户 UID |
| `Authorization` | Header | string | 是 | 管理员 token |

### POST /api/admin/users/:uid/unfreeze

- 同冻结接口，Path 为 `unfreeze`。

## 端管数据联动（对照客户端）

| 管理端字段 | 客户端对照 | 一致性 |
| --- | --- | --- |
| `rows[].uid` | `GET /api/user/profile` → `data.uid`；登录 `data.user.uid` | ✅ |
| `rows[].nickname` | `data.nickname` | ✅ |
| `rows[].realNameStatus` | `data.realNameVerified` | ⚠️ 布尔 ↔ 文案，见 [00-共用汇总§2.3](../后台管理一期/00-后台管理一期共用接口汇总.md) |
| `rows[].cashAsset` / `totalAsset` / `goldHoldingGrams` | `profile` 资产字段 | ⚠️ 总资产口径见 00 文档 |
| `POST .../freeze` | 登录 `423`、交易 `403` | ✅ 同一 `User.status` |

## 现状与目标差异

- 详情抽屉中「登录设备」「操作记录」等 Tab 若展示为空，需后端扩展用户会话/审计聚合（C 端 `UserLoginSession` 已落库，管理端查询接口可二期补充）。
- 列表 `total` 与筛选在服务端分页；`sequenceNo` 等为内存二次过滤时注意总数口径。

## 错误码与前端提示建议

- `401`：提示「登录已过期，请重新登录」
- `403`：提示「无权限执行此操作」
- `404`：提示「用户不存在」
- `409`：提示「状态冲突，请刷新后重试」
- `500`：提示「服务异常，请稍后重试」
