# admin-api-资金管理

## 接口清单（Method + Path + 权限）
- `GET /admin/funds/recharges`，权限：`admin:funds:read`
- `GET /admin/funds/withdrawals`，权限：`admin:funds:read`
- `POST /admin/funds/withdrawals/{orderId}/mute-alert`，权限：`admin:funds:read`
- `POST /admin/funds/withdrawals/{orderId}/reject`，权限：`admin:funds:audit`
- `POST /admin/funds/withdrawals/{orderId}/confirm-completed`，权限：`admin:funds:pay`
- `POST /admin/funds/manual-adjustments`，权限：`admin:funds:adjust`

## Request 参数表
### `GET /admin/funds/withdrawals`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| sortBy | query | string | 否 | 固定 `submittedAt` |
| sortOrder | query | string | 否 | 固定 `asc`，保证队列顺序 |
| status | query | string | 否 | `pending_review` / `transfer_processing` / `completed` / `rejected` |

### `POST /admin/funds/withdrawals/{orderId}/mute-alert`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| stopReason | body | string | 是 | `open_detail` / `manual_mute` |

### `POST /admin/funds/manual-adjustments`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| uid | body | integer | 是 | 用户 UID |
| adjustmentType | body | string | 是 | `manual_transfer` / `compensation` / `asset_adjustment` |
| amount | body | number | 是 | 金额 |
| reason | body | string | 是 | 调整原因 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| orderId | string | 订单号 |
| queueNo | integer | 提现队列号（按提交时间递增） |
| uid | integer | 用户 UID |
| channel | string | 渠道 |
| amount | number | 提现金额 |
| frozenAmount | number | 冻结金额 |
| status | string | `pending_review` / `transfer_processing` / `completed` / `rejected` |
| submittedAt | string | 提交时间 |
| freezeAppliedAt | string | 冻结生效时间 |
| confirmCompletedAt | string | 后台确认完成时间 |
| alertStatus | string | `ringing` / `muted` / `stopped` |
| alertStoppedAt | string | 提醒停止时间 |
| alertStopReason | string | `open_detail` / `manual_mute` |
| wechatQrCodeUrl | string | 微信收款码 |
| alipayQrCodeUrl | string | 支付宝收款码 |
| bankCardNo | string | 银行卡号 |
| tentativeAssetAfter | number | 当前暂定资产 |
| totalAssetAfter | number | 当前总资产 |
| traceId | string | 全链路追踪号 |

示例：
```json
{
  "code": 200,
  "data": {
    "orderId": "wd_20260405003",
    "queueNo": 3,
    "uid": 100018,
    "channel": "bank_card",
    "amount": 2000,
    "frozenAmount": 2000,
    "status": "pending_review",
    "submittedAt": "2026-04-05T11:15:00+08:00",
    "freezeAppliedAt": "2026-04-05T11:15:00+08:00",
    "confirmCompletedAt": null,
    "alertStatus": "ringing",
    "alertStoppedAt": null,
    "alertStopReason": null,
    "wechatQrCodeUrl": "https://example.com/wx-100018.png",
    "alipayQrCodeUrl": "https://example.com/alipay-100018.png",
    "bankCardNo": "622202********1234",
    "tentativeAssetAfter": 6800,
    "totalAssetAfter": 11200,
    "traceId": "trace_withdraw_003"
  }
}
```

## 业务错误码
- `4034001`：无资金访问权限
- `4034002`：无资金审核权限
- `4224003`：提现状态非法
- `4224004`：资产调整参数非法
- `4224005`：当前非交易时间，不能提现发起
- `4224006`：提现收款信息不完整（微信/支付宝/银行卡缺失）
- `4224007`：提现队列顺序冲突
- `4224008`：提现冻结扣减失败
- `4224009`：确认完成重复扣款拦截
- `4224010`：语音提醒状态非法

## 与最终定稿对应
- 充值按 24 小时自动到账处理，仅做对账查看。
- 充值到账后直接写入暂定资产和总资产。
- 提现仅交易时间可发起，提交即冻结并扣减暂定资产/总资产。
- 提现审核必须完整展示微信收款码、支付宝收款码、银行卡号。
- 提现订单按提交时间队列顺序展示，并触发后台语音持续提醒。
- 进入订单详情或手动静音后停止提醒。
- 线下转账后点击确认完成，订单完结且不得二次扣款。
- 手工补款/转账都必须实时且准确更新资产。
