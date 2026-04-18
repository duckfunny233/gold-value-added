# 注销账号-CancelAccountSettings

## 页面名称与路由
- 页面：注销账号（CancelAccountSettings）
- 路由：`/settings/cancel-account`

## 功能点列表（页面按钮/动作级）
- 发送注销短信验证码
- 输入安全密钥与短信验证码提交注销
- 注销成功后清理本地敏感数据并跳回登录

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 发送注销验证码（本地） | LOCAL | `SettingsService.sendCancelAccountOtp` | 返回 otpToken 与倒计时 | 本地 Mock |
| 提交注销（本地） | LOCAL | `SettingsService.cancelAccount` | 校验密钥与验证码后注销 | 本地 Mock |
| 发送注销验证码（建议） | POST | `/api/settings/account-cancel/send-otp` | 下发注销验证码 | 目标 |
| 提交注销（建议） | POST | `/api/settings/account-cancel` | 后端执行账号注销流程 | 目标 |

## 请求/响应关键字段
- 注销请求：`secretKey`、`smsCode`、`otpToken`
- 注销响应：`status`、`canceledAt`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 与手续费规则无直接关系。
- 目标建议在注销前由后端校验未完成提现/交易单，避免资金状态不一致。

## 错误码与前端提示建议
- `400`：提示“请输入完整信息”
- `422`：提示“密钥或短信验证码错误”
- `409`：提示“存在未完成资金订单，暂不可注销”
