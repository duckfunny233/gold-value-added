# 帮助服务-HelpServiceSettings

## 页面名称与路由
- 页面：帮助服务（HelpServiceSettings）
- 路由：`/settings/help`

## 功能点列表（页面按钮/动作级）
- 查看 FAQ
- 提交反馈
- 查看客服入口信息

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取帮助配置（本地） | LOCAL | `SettingsService.getHelpSettings` | 读取 FAQ 与帮助内容 | 本地 Mock |
| 提交反馈（本地） | LOCAL | `SettingsService.submitFeedback` | 提交反馈内容 | 本地 Mock |
| 提交反馈（建议） | POST | `/api/settings/help/feedback` | 落库用户反馈并生成工单 | 目标 |

## 请求/响应关键字段
- 反馈请求：`content`
- 反馈响应：`feedbackId`、`status`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 与手续费和扣款顺序无直接关系。

## 错误码与前端提示建议
- `400`：提示“反馈内容不能为空”
- `500`：提示“提交失败，请稍后重试”
