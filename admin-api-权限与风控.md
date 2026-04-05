# admin-api-权限与风控

## 接口清单（Method + Path + 权限）
- `GET /admin/risk/roles`，权限：`admin:risk:read`
- `POST /admin/risk/roles/assign`，权限：`admin:risk:write`
- `POST /admin/risk/users/{uid}/freeze`，权限：`admin:risk:write`
- `POST /admin/risk/users/{uid}/unfreeze`，权限：`admin:risk:write`
- `POST /admin/risk/platform/pause`，权限：`admin:risk:write`
- `POST /admin/risk/platform/resume`，权限：`admin:risk:write`
- `PUT /admin/risk/rules`，权限：`admin:risk:write`

## Request 参数表
### `POST /admin/risk/users/{uid}/freeze`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| uid | path | integer | 是 | 用户 UID |
| reason | body | string | 否 | 冻结原因 |

### `PUT /admin/risk/rules`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| withdrawInterceptEnabled | body | boolean | 是 | 是否开启提现拦截 |
| abnormalTradeThreshold | body | number | 是 | 异常交易阈值 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| uid | integer | 用户 UID |
| userStatus | string | 用户状态 |
| tradingStatus | string | 平台交易状态 |
| operator | string | 操作人 |
| traceId | string | 全链路追踪号 |

示例：
```json
{
  "code": 200,
  "data": {
    "uid": 100018,
    "userStatus": "frozen",
    "tradingStatus": "paused",
    "operator": "risk_admin",
    "traceId": "trace_risk_018"
  }
}
```

## 业务错误码
- `4037101`：无风控权限
- `4047102`：用户不存在
- `4097103`：状态不可重复切换

## 与最新模块分工对应
- 权限与风控负责角色管理、用户冻结、全站停盘、提现拦截、异常交易监控和风险预警。
