# admin-api-排行榜治理

## 接口清单（Method + Path + 权限）
- `GET /admin/leaderboard`，权限：`admin:leaderboard:read`
- `POST /admin/leaderboard/rebuild`，权限：`admin:leaderboard:write`
- `PUT /admin/leaderboard/rules`，权限：`admin:leaderboard:write`
- `POST /admin/leaderboard/exceptions/{id}/resolve`，权限：`admin:leaderboard:write`

## Request 参数表
### `PUT /admin/leaderboard/rules`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| sortField | body | string | 是 | `goldHoldingGrams` / `totalAsset` |
| order | body | string | 是 | `asc` / `desc` |
| remark | body | string | 否 | 规则说明 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| rank | integer | 排名 |
| uid | integer | 用户 UID |
| goldHoldingGrams | number | 黄金克数 |
| totalAsset | number | 总资产 |
| syncStatus | string | 同步状态 |
| rebuildVersion | string | 重排版本 |

示例：
```json
{
  "code": 200,
  "data": [
    {
      "rank": 1,
      "uid": 100001,
      "goldHoldingGrams": 88.8,
      "totalAsset": 69200.5,
      "syncStatus": "synced",
      "rebuildVersion": "lb_20260405_01"
    }
  ]
}
```

## 业务错误码
- `4036001`：无排行榜访问权限
- `4036002`：无排行榜写权限
- `4226003`：排序规则非法

## 与最新模块分工对应
- 排行榜治理负责数据重排、规则校验、同步监控和异常处理。
- 排行榜支持按黄金克数或总资产排序配置。
