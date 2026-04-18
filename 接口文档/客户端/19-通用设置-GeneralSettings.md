# 通用设置-GeneralSettings

## 页面名称与路由
- 页面：通用设置（GeneralSettings）
- 路由：`/settings/general`

## 功能点列表（页面按钮/动作级）
- 加载消息通知与主题设置
- 修改刷新频率和通知开关
- 保存通用设置

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取通用设置（本地） | LOCAL | `SettingsService.getGeneralSettings` | 读取设置项 | 本地 Mock |
| 更新通用设置（本地） | LOCAL | `SettingsService.updateGeneralSettings` | 保存设置项 | 本地 Mock |
| 通用设置（建议） | GET/PUT | `/api/settings/general` | 后端持久化通用设置 | 目标 |

## 请求/响应关键字段
- 本地字段：`noticePush`、`tradePush`、`servicePush`、`theme`、`refreshSeconds`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 与手续费规则无直接关系。

## 错误码与前端提示建议
- `500`：提示“设置保存失败，请重试”
