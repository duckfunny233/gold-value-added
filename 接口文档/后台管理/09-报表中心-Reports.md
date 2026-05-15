# 报表中心-Reports

## 页面名称与路由
- 页面：报表中心（Reports）
- 路由：`/reports`

## 功能点列表（页面按钮/动作级）
- 报表任务列表查询（支持报表类型、任务状态、时间范围筛选）
- 查看报表任务详情
- 下载报表
- 生成新报表
- 删除报表任务

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取报表任务列表 | GET | `/api/admin/reports` | 获取报表任务列表 | 是 |
| 获取报表任务详情 | GET | `/api/admin/reports/:jobId` | 获取指定报表任务详情 | 是 |
| 生成报表 | POST | `/api/admin/reports/generate` | 创建报表生成任务 | 是 |
| 下载报表 | GET | `/api/admin/reports/:jobId/download` | 下载报表文件 | 前端调用（后端待确认） |
| 删除报表任务 | DELETE | `/api/admin/reports/:jobId` | 删除报表任务 | 前端调用（后端待确认） |

## 请求/响应关键字段

### GET /api/admin/reports
- 请求 Query：`reportType`、`status`、`timeRange`、`page`、`pageSize`
- 响应：`code`、`message`、`data.rows[]`、`data.total`

### GET /api/admin/reports/:jobId
- 请求 Param：`jobId`
- 响应：`code`、`message`、`data`

### POST /api/admin/reports/generate
- 请求 Body：`reportType`、`timeRange`、`uid`、`channel`、`format`、`name`
- 响应：`code`、`message`、`data.jobId`

### GET /api/admin/reports/:jobId/download
- 请求 Param：`jobId`
- 响应：文件流（CSV/Excel）

### DELETE /api/admin/reports/:jobId
- 请求 Param：`jobId`
- 响应：`code`、`message`、`data`

## 现状与目标差异
- 前端存在 `downloadReport`、`deleteReport` 调用，但对应后端接口在当前控制器中未找到，可能尚未实现。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `404`：提示“报表任务不存在”
- `500`：提示“服务异常，请稍后重试"
