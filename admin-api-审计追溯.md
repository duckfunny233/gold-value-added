# admin-api-审计追溯

## 接口清单（Method + Path + 权限）
- `GET /admin/audit/traces/{traceId}`，权限：`admin:audit:read`
- `GET /admin/audit/logs`，权限：`admin:audit:read`
- `GET /admin/audit/hash-records`，权限：`admin:audit:read`

## Request 参数表
### `GET /admin/audit/logs`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| traceId | query | string | 否 | 全链路追踪号 |
| uid | query | integer | 否 | 用户 UID |
| module | query | string | 否 | 模块名 |
| eventType | query | string | 否 | 事件类型 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| traceId | string | 全链路追踪号 |
| module | string | 来源模块 |
| eventType | string | 事件类型 |
| uid | integer | 用户 UID |
| bizOrderId | string | 业务单号 |
| hashValue | string | 64 位 SHA-256 哈希 |
| chainSyncStatus | string | 半公开金链同步状态 |
| createdAt | string | 生成时间 |

示例：
```json
{
  "code": 200,
  "data": [
    {
      "traceId": "trace_trade_008",
      "module": "trade",
      "eventType": "match_success",
      "uid": 100018,
      "bizOrderId": "tr_20260405008",
      "hashValue": "d41d8cd98f00b204e9800998ecf8427e5f2cb9d7f8f1c6f1a0b6d8d4a1c2e3f4",
      "chainSyncStatus": "synced",
      "createdAt": "2026-04-05T12:06:00+08:00"
    }
  ]
}
```

## 业务错误码
- `4038001`：无审计访问权限
- `4048002`：traceId 不存在
- `4098003`：哈希校验失败

## 与最终定稿对应
- 审计追溯负责所有操作日志、按 `traceId` 全链路追踪。
- 每笔交易和每笔资产变动必须生成 64 位 SHA-256 哈希。
- 哈希必须同步写入半公开金链，用于防伪、防篡改、可溯源。
