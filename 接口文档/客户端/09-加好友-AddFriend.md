# 加好友-AddFriend

## 页面名称与路由
- 页面：加好友（AddFriend）
- 路由：`/chat/add-friend`

## 功能点列表（页面按钮/动作级）
- 关键词搜索用户
- 查看用户资料
- 发送好友申请
- 确认好友申请并进入会话

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 搜索好友 | GET | `/api/chat/friend-search?keyword={keyword}` | 按关键词搜索用户 | 是 |
| 好友资料 | GET | `/api/chat/friend-profile/{id}` | 查看目标用户资料 | 是 |
| 发送好友申请 | POST | `/api/chat/friend-request` | 发送好友请求 | 是 |
| 确认好友申请 | POST | `/api/chat/friend-request/{requestId}/confirm` | 同意申请并创建会话 | 是 |

## 请求/响应关键字段
- 搜索请求：`keyword`
- 申请请求：`targetUserId`、`message`
- 确认响应：`requestId`、`status`、`chatId`、`chatName`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 本页无资金扣款逻辑，不受新手续费与扣款顺序影响。

## 错误码与前端提示建议
- `404`：提示“未找到相关用户”
- `409`：提示“申请已发送，请勿重复操作”
