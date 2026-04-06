# admin-api-交易管理

## 接口清单（Method + Path + 权限）
- `GET /admin/trades`，权限：`admin:trades:read`
- `GET /admin/trades/session-status`，权限：`admin:trades:read`
- `POST /admin/trades/sync-retry`，权限：`admin:trades:sync`
- `POST /admin/platform/trading/pause`，权限：`admin:trades:control`
- `POST /admin/platform/trading/resume`，权限：`admin:trades:control`

## Request 参数表
### `GET /admin/trades`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| tradeNo | query | string | 否 | 交易号 |
| tradeType | query | string | 否 | `buy` / `sell` |
| uid | query | integer | 否 | 用户 UID |
| status | query | string | 否 | 交易状态 |
| syncStatus | query | string | 否 | 同步状态 |
| timeRange | query | string | 否 | 时间范围 |

### `GET /admin/trades/session-status`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| timezone | query | string | 否 | 默认 `Asia/Shanghai` |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| tradeNo | string | 交易号 |
| tradeType | string | 买入或卖出 |
| uid | integer | 用户 UID |
| amount | number | 金额 |
| grams | number | 克数 |
| status | string | 状态 |
| syncStatus | string | 同步状态 |
| matchPrice | number | 成交价 |
| sessionSource | string | 固定 `SGE_OFFICIAL` |
| currentSessionStatus | string | `open` / `closed` |
| currentWindow | string | 当前生效时段 |
| nextOpenAt | string | 下一次开盘时间 |
| nextCloseAt | string | 下一次收盘时间 |
| traceId | string | 全链路追踪号 |

示例：
```json
{
  "code": 200,
  "data": [
    {
      "tradeNo": "tr_20260405008",
      "tradeType": "sell",
      "uid": 100018,
      "amount": 2680.5,
      "grams": 3.5,
      "status": "matched",
      "syncStatus": "pending_retry",
      "matchPrice": 765.86,
      "sessionSource": "SGE_OFFICIAL",
      "currentSessionStatus": "open",
      "currentWindow": "09:00-11:30",
      "nextOpenAt": "2026-04-06T13:30:00+08:00",
      "nextCloseAt": "2026-04-06T15:30:00+08:00",
      "traceId": "trace_trade_008"
    }
  ]
}
```

## 业务错误码
- `4035001`：无交易访问权限
- `4035002`：无交易控制权限
- `4225003`：交易时段同步状态异常
- `4095004`：当前状态不可重复切换

## 与最终定稿对应
- 交易管理覆盖买卖交易全流程、自动撮合、停盘控制、上金所时段自动同步和同步重试。
- 撮合逻辑必须写入代码，且遵循价格优先、时间优先。
- 交易时段必须自动同步上金所官方开休盘（Asia/Shanghai：周一至周五 `09:00-11:30`、`13:30-15:30`、`20:00-次日02:30`），周末和法定节假日自动休市，无需人工配置。
