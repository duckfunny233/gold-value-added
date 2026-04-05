# admin-api-首页仪表盘

## 接口清单（Method + Path + 权限）
- `GET /admin/dashboard/overview`，权限：`admin:dashboard:read`
- `GET /admin/dashboard/events`，权限：`admin:dashboard:read`
- `GET /admin/dashboard/rules`，权限：`admin:dashboard:read`
- `POST /admin/dashboard/notices`，权限：`admin:dashboard:notice:write`
- `PUT /admin/dashboard/notices/{noticeId}`，权限：`admin:dashboard:notice:write`
- `DELETE /admin/dashboard/notices/{noticeId}`，权限：`admin:dashboard:notice:write`

## Request 参数表
### `GET /admin/dashboard/overview`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| date | query | string | 否 | 统计日期 |
| module | query | string | 否 | 模块过滤 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| pendingAuditCount | integer | 待审核单据数 |
| frozenUserCount | integer | 冻结用户数 |
| goldReferencePrice | number | 黄金参考价 |
| tradingStatus | string | 全站交易状态 |
| syncDelay | number | 同步延迟 |
| leaderboardRebuildStatus | string | 排行榜重排状态 |
| paymentReconcileStatus | string | 支付对账状态 |
| withdrawAlertRingingCount | integer | 当前语音提醒中的提现单数 |
| pollingEnabled | boolean | 公告前端轮巡展示开关 |

示例：
```json
{
  "code": 200,
  "data": {
    "pendingAuditCount": 6,
    "frozenUserCount": 4,
    "goldReferencePrice": 768.23,
    "tradingStatus": "running",
    "syncDelay": 1.8,
    "leaderboardRebuildStatus": "healthy",
    "paymentReconcileStatus": "healthy",
    "withdrawAlertRingingCount": 2,
    "pollingEnabled": true
  }
}
```

## 业务错误码
- `4037001`：无仪表盘访问权限
- `4037002`：无公告管理权限
- `4227003`：公告内容校验失败

## 与最终定稿对应
- 仪表盘负责全局总览、系统监控、实时事件流、规则提醒和公告轮播管理。
- 公告由后台发布，前端按轮巡方式展示。
- 提现新单语音提醒状态需要在仪表盘总览中可见。
