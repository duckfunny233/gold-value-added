# 系统配置-SystemConfig

## 页面名称与路由
- 页面：系统配置（SystemConfig）
- 路由：`/system-config`

## 功能点列表（页面按钮/动作级）
- 系统配置列表查询（支持配置项名称、分组、状态筛选）
- 查看配置项详情
- 新增配置项
- 编辑配置项
- 删除配置项
- 批量更新配置

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取系统配置 | GET | `/api/admin/config` | 获取系统配置列表 | 前端调用（后端待确认） |
| 新增系统配置 | POST | `/api/admin/config` | 新增系统配置项 | 前端调用（后端待确认） |
| 更新系统配置 | PATCH | `/api/admin/config` | 更新系统配置项 | 前端调用（后端待确认） |
| 删除系统配置 | DELETE | `/api/admin/config/:configId` | 删除系统配置项 | 前端调用（后端待确认） |

## 请求/响应关键字段

### GET /api/admin/config
- 请求 Query：`name`、`group`、`status`、`page`、`pageSize`
- 响应：`code`、`message`、`data.rows[]`、`data.total`

### POST /api/admin/config
- 请求 Body：`name`、`value`、`group`、`description`、`status`
- 响应：`code`、`message`、`data`

### PATCH /api/admin/config
- 请求 Body：`name`、`value`、`group`、`description`、`status`
- 响应：`code`、`message`、`data`

### DELETE /api/admin/config/:configId
- 请求 Param：`configId`
- 响应：`code`、`message`、`data`

## 现状与目标差异
- `/api/admin/config` 系列接口在前端 `ConfigService` 中有调用，但在后端源码中未找到对应控制器，可能尚未实现或位于其他服务中。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `404`：提示“配置项不存在”
- `500`：提示“服务异常，请稍后重试"
