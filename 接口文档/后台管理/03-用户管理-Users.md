# 用户管理-Users

## 页面名称与路由
- 页面：用户管理（Users）
- 路由：`/users`

## 功能点列表（页面按钮/动作级）
- 用户列表查询（支持用户ID、UID、注册序号、实名状态筛选）
- 用户详情查看（概览、注册信息、实名信息、资产明细、登录设备、操作记录、账户控制）
- 冻结/解冻用户
- 重置用户密码
- 强制用户登出
- 踢下线设备
- 生成用户报表

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取用户列表 | GET | `/api/admin/users` | 获取用户列表及关联记录 | 是 |
| 冻结用户 | POST | `/api/admin/users/:uid/freeze` | 冻结指定用户账号 | 是 |
| 解冻用户 | POST | `/api/admin/users/:uid/unfreeze` | 解冻指定用户账号 | 是 |
| 人工复核用户 | POST | `/api/admin/users/:uid/manual-check` | 对用户进行人工复核 | 是 |
| 生成报表 | POST | `/api/admin/reports/generate` | 生成用户相关报表 | 是 |

## 请求/响应关键字段

### GET /api/admin/users
- 请求 Query：`userId`、`uid`、`sequenceNo`、`realNameStatus`、`rechargeStatus`、`withdrawStatus`、`page`、`pageSize`
- 响应：`code`、`message`、`data.rows[]`、`data.total`、`data.selectedUser`、`data.relatedRecords`

### POST /api/admin/users/:uid/freeze
- 请求 Param：`uid`
- 响应：`code`、`message`、`data`

### POST /api/admin/users/:uid/unfreeze
- 请求 Param：`uid`
- 响应：`code`、`message`、`data`

### POST /api/admin/users/:uid/manual-check
- 请求 Param：`uid`
- 请求 Body：`note`
- 响应：`code`、`message`、`data`

### POST /api/admin/reports/generate
- 请求 Body：`reportType=operate`、`timeRange`、`uid`、`format`、`name`
- 响应：`code`、`message`、`data.jobId`

## 现状与目标差异
- 前端存在 `kickDevice`、`resetUserPassword`、`forceLogoutUser` 等调用，但对应后端接口在当前控制器中未找到，可能尚未实现或位于其他模块。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `404`：提示“用户不存在”
- `500`：提示“服务异常，请稍后重试"
