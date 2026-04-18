# 个人中心-Profile

## 页面名称与路由
- 页面：个人中心（Profile）
- 路由：`/profile`

## 功能点列表（页面按钮/动作级）
- 加载用户资料与资产
- 查询是否有充值记录、已绑收款方式
- 充值弹窗下单与确认
- 提现弹窗发短信与提交提现
- 绑定/解绑收款方式
- 退出登录

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 用户资料 | GET | `/api/user/profile` | 拉取昵称、实名状态、资产、持仓 | 是 |
| 充值历史检查 | GET | `/api/user/recharge-history/check` | 判定是否允许提现前置条件 | 是 |
| 收款方式查询 | GET | `/api/user/payment-method` | 读取绑定状态 | 是 |
| 绑定收款方式 | POST | `/api/user/payment-method` | 保存微信/支付宝/银行卡 | 是（弹窗） |
| 解绑收款方式 | DELETE | `/api/user/payment-method` | 解绑收款方式 | 是（弹窗） |
| 创建充值单 | POST | `/api/wallet/recharge` | 发起充值订单 | 是（弹窗） |
| 确认充值 | POST | `/api/wallet/recharge/{orderId}/confirm` | 用户确认已支付 | 是（弹窗） |
| 提现短信 | POST | `/api/wallet/withdraw/send-sms` | 发送提现验证码 | 是（弹窗） |
| 提现提交 | POST | `/api/wallet/withdraw` | 发起提现申请 | 是（弹窗） |
| 退出登录 | POST | `/api/auth/logout` | 注销会话并清理本地数据 | 是 |

## 请求/响应关键字段
- 资料响应：`assets[]`、`realNameVerified`、`goldPositions[]`、`silverPositions[]`
- 充值请求：`channel`、`amount`
- 提现请求：`channel`、`amount`、`smsCode`、`smsToken`、`mobile`
- 提现响应：`withdrawId`、`status`、`feeRate`、`feeAmount`、`netAmount`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 提现接口目标需固定返回 `feeRate=0.001`、`feeAmount`、`netAmount`，并与后台审核口径一致。
- 资产总览需补全 `withdrawablePrincipal`、`principalBalance`、`appreciationIncome` 字段用于后续资金说明。

## 错误码与前端提示建议
- `400`：提示“参数错误，请检查金额或手机号”
- `402`：提示“余额不足或可提现本金不足”
- `422`：提示“短信验证码错误”
