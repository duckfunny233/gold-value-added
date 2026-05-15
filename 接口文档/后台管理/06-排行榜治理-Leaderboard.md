# 排行榜治理-Leaderboard

## 页面名称与路由
- 页面：排行榜治理（Leaderboard）
- 路由：`/leaderboard`

## 功能点列表（页面按钮/动作级）
- 排行榜列表查询（支持用户UID、排序规则、同步状态、时间范围筛选）
- 更新排序规则
- 重建排行榜
- 规则参数配置（周期、权重、门槛）
- 预览榜单效果
- 标记作弊用户（从榜单移除/标记异常）
- 生成排行榜报表

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取排行榜数据 | GET | `/api/admin/leaderboard` | 获取排行榜列表与监控数据 | 是 |
| 更新排序规则 | POST | `/api/admin/leaderboard/rule` | 更新排行榜排序规则 | 是 |
| 重建排行榜 | POST | `/api/admin/leaderboard/rebuild` | 触发排行榜重建任务 | 是 |
| 重试同步 | POST | `/api/admin/leaderboard/retry-sync` | 重试排行榜同步 | 是 |
| 生成报表 | POST | `/api/admin/reports/generate` | 生成排行榜相关报表 | 是 |

## 请求/响应关键字段

### GET /api/admin/leaderboard
- 请求 Query：`uid`、`sortRule`（goldHoldingGrams/totalAsset）、`syncStatus`、`timeRange`
- 响应：`code`、`message`、`data.rows[]`、`data.monitors[]`、`data.currentRules`

### POST /api/admin/leaderboard/rule
- 请求 Body：`sortRule`、`period`、`weightGold`、`weightAsset`、`threshold`
- 响应：`code`、`message`、`data`

### POST /api/admin/leaderboard/rebuild
- 请求 Body：`sortRule`
- 响应：`code`、`message`、`data`

### POST /api/admin/leaderboard/retry-sync
- 请求 Body：`sortRule`
- 响应：`code`、`message`、`data`

### POST /api/admin/reports/generate
- 请求 Body：`reportType=operate`、`timeRange`、`format`、`name`
- 响应：`code`、`message`、`data.jobId`

## 现状与目标差异
- 前端存在 `previewLeaderboard`、`markCheatUser` 等调用，但对应后端接口在当前控制器中未找到，可能尚未实现。

## 错误码与前端提示建议
- `401`：提示“登录已过期，请重新登录”
- `403`：提示“无权限执行此操作”
- `500`：提示“服务异常，请稍后重试"
