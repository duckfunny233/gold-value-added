# 交易页-Trade

## 页面名称与路由
- 页面：交易页（Trade）
- 路由：`/trade`

## 功能点列表（页面按钮/动作级）
- 拉取可用资产余额用于买入校验
- 提交买单/卖单
- 查询个人交易记录
- 展示五档盘口（当前回退本地模拟）

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 用户资料 | GET | `/api/user/profile` | 读取余额用于买入前校验 | 是 |
| 交易记录 | GET | `/api/app/trades` | 查询用户交易单 | 是 |
| 买入下单 | POST | `/api/app/trades/buy` | 提交买单并撮合 | 是 |
| 卖出下单 | POST | `/api/app/trades/sell` | 提交卖单并撮合 | 是 |
| 五档盘口 | GET | `/api/market/order-book?asset={asset}` | 获取买卖五档数据 | 目标（前端方法未落地） |

## 请求/响应关键字段
- 下单请求：`uid`、`username`、`assetCode`、`price`、`quantityGrams`
- 下单响应：`tradeNo`、`tradeType`、`amount`、`feeRate`、`feeAmount`、`netAmount`、`traceId`
- 记录响应：`data[].status`、`syncStatus`、`syncLagMs`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 目标必须在买卖响应中稳定返回 `feeRate=0.001`、`feeAmount`、`netAmount`。
- 扣款顺序规则不作用于买卖下单本身，但交易后资产口径要与 `principalBalance/appreciationIncome` 一致。

## 错误码与前端提示建议
- `400`：提示“下单参数无效”
- `403`：提示“当前休市或账号被冻结”
- `409`：提示“订单处理中，请勿重复提交”
