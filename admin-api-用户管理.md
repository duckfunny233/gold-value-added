# admin-api-用户管理

## 接口清单（Method + Path + 权限）
- `GET /admin/users`，权限：`admin:users:read`
- `GET /admin/users/{uid}`，权限：`admin:users:read`
- `POST /admin/users/{uid}/freeze`，权限：`admin:users:write`
- `POST /admin/users/{uid}/unfreeze`，权限：`admin:users:write`
- `POST /admin/users/export`，权限：`admin:users:export`
- `POST /admin/users/payout-profiles/verify`，权限：`admin:users:verify`

## Request 参数表
### `GET /admin/users`
| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| userId | query | string | 否 | 内部 ID |
| uid | query | integer | 否 | 业务 UID |
| sequenceNo | query | integer | 否 | 注册序号 |
| realNameStatus | query | string | 否 | 实名状态 |
| rechargeStatus | query | string | 否 | 充值状态 |
| withdrawStatus | query | string | 否 | 提现状态 |

## Response 字段表与示例
| 字段 | 类型 | 说明 |
|---|---|---|
| userId | string | 内部用户 ID |
| uid | integer | 业务 UID |
| sequenceNo | integer | 注册序号 |
| realNameStatus | string | 实名状态 |
| rechargeStatus | string | 充值状态 |
| withdrawStatus | string | 提现状态 |
| cashAsset | number | 现金资产 |
| totalAsset | number | 总资产 |

示例：
```json
{
  "code": 200,
  "data": [
    {
      "userId": "u_100018",
      "uid": 100018,
      "sequenceNo": 100018,
      "realNameStatus": "verified",
      "rechargeStatus": "has_recharge",
      "withdrawStatus": "normal",
      "cashAsset": 12000,
      "totalAsset": 15320.8
    }
  ]
}
```

## 业务错误码
- `4032001`：无用户查询权限
- `4032002`：无用户写权限
- `4042003`：用户不存在

## 与最新模块分工对应
- 用户管理负责全生命周期管理、批量导出、批量校验收款信息和跨模块关联查询。
