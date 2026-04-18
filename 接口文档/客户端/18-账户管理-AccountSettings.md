# 账户管理-AccountSettings

## 页面名称与路由
- 页面：账户管理（AccountSettings）
- 路由：`/settings/account`

## 功能点列表（页面按钮/动作级）
- 查看账号资料
- 修改昵称、头像等信息
- 保存账户资料

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取账户设置（本地） | LOCAL | `SettingsService.getAccountSettings` | 读取账户资料 | 本地 Mock |
| 更新账户设置（本地） | LOCAL | `SettingsService.updateAccountSettings` | 保存账户资料 | 本地 Mock |
| 账户设置（建议） | GET/PUT | `/api/settings/account` | 后端统一管理账户设置 | 目标 |

## 请求/响应关键字段
- 本地字段：`nickname`、`avatar`、`mobile`、`bindStatus`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 不涉及手续费与扣款顺序。

## 错误码与前端提示建议
- `400`：提示“资料格式不正确”
- `500`：提示“保存失败，请稍后重试”
