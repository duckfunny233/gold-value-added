# admin-api-交易管理

## 接口清单（Method + Path + 权限）
- `GET /admin/trades`，权限：`admin:trades:read`
- `POST /admin/trades/sync-retry`，权限：`admin:trades:sync`
- `PUT /admin/trades/session`，权限：`admin:trades:session`
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

### `PUT /admin/trades/session`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| startTime | body | string | 是 | 交易开始时间 |
| endTime | body | string | 是 | 交易结束时间 |
| timezone | body | string | 是 | 时区 |

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
      "traceId": "trace_trade_008"
    }
  ]
}
```

## 业务错误码
- `4035001`：无交易访问权限
- `4035002`：无交易控制权限
- `4225003`：交易时间配置非法
- `4095004`：当前状态不可重复切换

## 与最终定稿对应
- 交易管理覆盖买卖交易全流程、自动撮合、停盘控制、交易时间控制和同步重试。
- 撮合逻辑必须写入代码，且遵循价格优先、时间优先。
