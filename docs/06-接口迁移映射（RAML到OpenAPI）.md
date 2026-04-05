# 接口迁移映射（RAML 到 OpenAPI）

## 1. 迁移原则

1. `docs/openapi.yaml` 是当前版本唯一主规范。
2. `docs/api.raml` 仅作为历史参考，不再作为新增功能来源。
3. 接口重构以最新后台模块职责和数据归属为主，不再沿用旧版单体式交易与资金语义。

## 2. 旧接口到新接口映射

| 旧路径 | 旧含义 | 新路径 | 新规则 |
|---|---|---|---|
| `/auth/register` | 注册 | `/auth/register` | 注册后返回 `uid` 与 `sequenceNo` |
| `/auth/login` | 登录 | `/auth/login` | 保持登录语义 |
| `/market/prices` | 综合行情 | `/app/market/au9999/ticker` | 当前版本聚焦 AU9999 |
| `/market/kline` | K 线数据 | `/app/market/au9999/kline` | 保留现有 K 线组件 |
| `/trade/order` | 泛化下单 | `/app/trades/buy` + `/app/trades/sell` | 拆分买单和卖单 |
| `/trade/orders` | 订单列表 | `/app/trades` | 统一交易列表与同步状态 |
| `/user/profile` | 混合用户资料 | `/app/assets/overview` + `/app/user/profile` | 资产与资料拆分 |

## 3. 本次新增前台接口

1. `/app/recharges`
2. `/app/withdrawals`
3. `/app/trades/buy`
4. `/app/trades/sell`
5. `/app/trades`
6. `/app/market/au9999/ticker`
7. `/app/market/au9999/kline`
8. `/app/notices`

## 4. 本次新增后台接口

1. `/admin/dashboard/overview`
2. `/admin/dashboard/events`
3. `/admin/dashboard/notices`
4. `/admin/users`
5. `/admin/users/export`
6. `/admin/users/payout-profiles/verify`
7. `/admin/funds/recharges`
8. `/admin/funds/withdrawals`
9. `/admin/funds/withdrawals/{orderId}/mute-alert`
10. `/admin/funds/withdrawals/{orderId}/confirm-completed`
11. `/admin/funds/manual-adjustments`
12. `/admin/trades`
13. `/admin/trades/sync-retry`
14. `/admin/trades/session`
15. `/admin/leaderboard/rebuild`
16. `/admin/leaderboard/rules`
17. `/admin/risk/users/{uid}/freeze`
18. `/admin/risk/users/{uid}/unfreeze`
19. `/admin/risk/platform/pause`
20. `/admin/risk/platform/resume`
21. `/admin/audit/traces/{traceId}`
22. `/admin/reports/overview`

## 5. 字段迁移重点

1. 新接口统一保留 `uid`、`sequenceNo`、`traceId`、`syncStatus` 关键字段。
2. 充值单不再需要人工确认字段，改为自动入账和对账字段。
3. 交易单需明确 `tradeType`、`matchPrice`、`matchTime`、`syncStatus`。
4. 提现单需明确 `frozenAmount`、`freezeAppliedAt`、`alertStatus`、`confirmCompletedAt`、`operator`。
5. 仪表盘接口需包含核心指标、系统监控、事件流和公告数据。

## 6. 删除或停用的旧语义

1. 停用旧版“充值确认到账”后台动作接口。
2. 停用旧版“只支持买入”的交易语义。
3. 停用没有 `traceId` 和 `syncStatus` 的简化审计语义。

## 7. 迁移验收

1. 充值接口完成自动入账，无人工确认步骤。
2. 提现接口必须支持“提交即冻结扣减、确认完成不二次扣款、拒绝解冻回补、语音提醒状态流转”。
3. 交易接口覆盖买单、卖单、撮合状态和同步状态。
4. 仪表盘接口可支撑公告、事件流、系统监控。
5. 风控接口可真实控制停盘、解盘、冻结、解冻。
