# 聊天详情-ChatDetail

## 页面名称与路由
- 页面：聊天详情（ChatDetail）
- 路由：`/chat/:id`

## 功能点列表（页面按钮/动作级）
- 拉取消息分页
- 发送文本消息
- 打开转账弹窗并提交转账
- 列表轮询刷新会话信息

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 消息列表 | GET | `/api/chat/messages/{id}?page={page}&limit={limit}` | 获取聊天消息分页 | 是 |
| 发送消息 | POST | `/api/chat/send` | 发送文本消息 | 是 |
| 会话列表（补充标题） | GET | `/api/chat/list` | 根据 chatId 回填会话名与类型 | 是 |
| 转账目标列表 | GET | `/api/chat/transfer-targets` | 获取可转账对象与场景 | 是（弹窗） |
| 聊天转账 | POST | `/api/chat/transfer` | 在会话中发起支付转账 | 是（弹窗） |

## 请求/响应关键字段
- 发送消息请求：`chatId`、`text`
- 转账请求：`chatId`、`recipientUid`、`amount`、`note`
- 转账响应：`orderId`、`amount`、`status`、`appreciationUsed`、`principalUsed`、`receiverFeeAmount`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 现状文档未强约束扣款顺序。
- 目标需保证 `/api/chat/transfer` 最终映射到支付引擎规则：先扣 `appreciationIncome`，不足再扣 `principalBalance`，并返回收款手续费拆分字段。

## 错误码与前端提示建议
- `400`：提示“消息或转账参数无效”
- `402`：提示“余额不足”
- `409`：提示“订单处理中，请勿重复提交”
