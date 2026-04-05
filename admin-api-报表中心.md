# admin-api-报表中心

## 接口清单（Method + Path + 权限）
- `GET /admin/reports/overview`，权限：`admin:reports:read`
- `POST /admin/reports/generate`，权限：`admin:reports:write`
- `POST /admin/reports/export`，权限：`admin:reports:export`

## Request 参数表
### `POST /admin/reports/generate`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| reportType | body | string | 是 | 报表类型 |
| timeRange | body | string | 是 | 时间范围 |
| dimensions | body | array | 否 | 统计维度 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| userGrowth | integer | 用户增长数 |
| tradeVolume | number | 交易量 |
| tradeAmount | number | 交易额 |
| fundFlowAmount | number | 资金流水额 |
| withdrawAuditCount | integer | 提现审核单数 |
| syncExceptionCount | integer | 同步异常数 |

示例：
```json
{
  "code": 200,
  "data": {
    "userGrowth": 32,
    "tradeVolume": 512.8,
    "tradeAmount": 395000.6,
    "fundFlowAmount": 218000.3,
    "withdrawAuditCount": 18,
    "syncExceptionCount": 3
  }
}
```

## 业务错误码
- `4039001`：无报表访问权限
- `4229002`：报表参数非法

## 与最新模块分工对应
- 报表中心负责用户增长、交易数据、资金流水等运营报表，自定义报表生成、导出和可视化统计。
