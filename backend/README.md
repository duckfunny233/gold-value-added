# 金链·GYC 后端骨架

`backend` 目录现在已经切成一套可作为正式起点的 NestJS 模块化单体骨架，默认技术栈如下：

- NestJS
- PostgreSQL 16
- Prisma
- Redis
- Swagger / OpenAPI
- Docker Compose

## 当前目录

```text
backend
├── docker-compose.yml
├── nest-cli.json
├── package.json
├── prisma
│   └── schema.prisma
├── src
│   ├── app.module.ts
│   ├── common
│   │   ├── filters
│   │   ├── interceptors
│   │   └── middleware
│   └── modules
│       ├── audit
│       ├── auth
│       ├── dashboard
│       ├── fund
│       ├── leaderboard
│       ├── market
│       ├── report
│       ├── risk
│       ├── system
│       ├── trade
│       └── user
└── tsconfig.json
```

## 已落地内容

1. 模块化单体结构，按业务域拆分后端模块。
2. 统一全局路由前缀 `api`。
3. 统一响应结构 `{ code, message, traceId, data }`。
4. 全局 `traceId` 中间件，方便后续审计追踪。
5. Prisma 初始数据模型，覆盖用户、资产、充值、提现、交易、撮合、审计、哈希存证、公告、系统配置。
6. PostgreSQL + Redis 的本地 `docker-compose.yml`。
7. Swagger 文档入口预留。

## 模块职责

- `auth`：注册、登录、UID 分配
- `user`：用户资料与资产概览
- `fund`：充值、提现、后台资金审核
- `trade`：买单、卖单、撮合规则入口（开休盘状态由上金所时段同步结果驱动）
- `payment`：增值收益二维码支付
- `market`：上金所 AU9999 行情与交易时段同步接口
- `dashboard`：仪表盘与公告
- `risk`：风控预警
- `audit`：审计记录和哈希存证查询
- `report`：报表总览
- `leaderboard`：排行榜治理

## 本地启动

1. 进入目录

```bash
cd backend
```

2. 复制环境变量

```bash
cp .env.example .env
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
```

3. 启动 PostgreSQL 和 Redis

```bash
docker compose up -d
```

4. 安装依赖

```bash
npm install
```

5. 生成 Prisma Client

```bash
npm run prisma:generate
```

6. 执行迁移

```bash
npm run prisma:migrate -- --name init
```

7. 启动开发服务

```bash
npm run start:dev
```

## 默认访问地址

- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## 推荐下一步

建议按下面顺序继续开发真实业务：

1. 接入 `PrismaService` 与真实数据库读写
2. 给 `fund` 实现提现冻结 / 解冻事务
3. 给 `trade` 实现价格优先、时间优先撮合
4. 给 `market` 接入上金所官方交易时段自动同步（周一至周五 `09:00-11:30`、`13:30-15:30`、`20:00-次日02:30`；周末和法定节假日自动休市）
5. 给 `audit` 接入 SHA-256 存证与链上同步状态
6. 接入 JWT、RBAC、Redis 队列和 WebSocket 实时广播

## 资金模块闭环 V1

`fund` 模块当前已落地的资金闭环口径如下：

1. 充值自动到账
   - 接口：`POST /api/app/recharges`
   - 行为：创建充值单后同事务自动入账，订单直接置为 `COMPLETED`
   - 同步写入：`ledger_entry(RECHARGE)`、`audit_log`、`hash_record(SHA-256 64 位)`
   - 资产影响：`tentativeAsset`、`cashAsset`、`totalAsset` 同步增加

2. 提现冻结与人工确认
   - 接口：
     - `POST /api/app/withdrawals`
     - `POST /api/admin/funds/withdrawals/:id/approve`
     - `POST /api/admin/funds/withdrawals/:id/reject`
     - `POST /api/admin/funds/withdrawals/:id/confirm-completed`
   - 规则：
     - 提现提交即冻结
     - 只从 `tentativeAsset` / `totalAsset` 扣减一次
     - 完成时只释放 `withdrawFrozenAmount`
     - 队列按 `queueNo + submittedAt` 升序稳定返回

3. 后台手工转账 / 补款
   - 接口：
     - `POST /api/admin/funds/manual-transfer`
     - `POST /api/admin/funds/manual-adjust`
   - 要求：管理员鉴权
   - 行为：实时调整 `tentativeAsset`、`totalAsset`
   - 同步写入：`ledger_entry(MANUAL_ADJUST)`、`audit_log`、`hash_record`

4. 验证命令

```powershell
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 交易与风控闭环 V1

`trade`、`market`、`risk` 模块当前已落地的交易与风控闭环口径如下：

1. 交易真实落库与自动撮合
   - 接口：
     - `POST /api/app/trades/buy`
     - `POST /api/app/trades/sell`
   - 行为：
     - 买卖单真实写入 `trade_order`
     - 同事务内执行撮合并生成 `trade_match`
     - 撮合规则固定为价格优先、时间优先
   - 资产影响：
     - 买入成交后扣减 `tentativeAsset`、`cashAsset`，增加 `goldHoldingGrams`
     - 卖出成交后减少 `goldHoldingGrams`，增加 `tentativeAsset`、`cashAsset`
   - 同步写入：`ledger_entry`、`audit_log`、`hash_record(SHA-256 64 位)`

2. 交易时段自动同步与交易前校验
   - 服务：`TradeRuntimeService`
   - 存储：复用 `system_config`
     - `trade_sessions`
     - `trade_runtime_status`
     - `trade_manual_control`
     - `trade_holiday_overrides`
   - 机制：
     - 模块初始化时同步一次
     - 定时任务每 30 分钟刷新交易时段
     - 当前非交易时段或已停盘时，买卖单直接拒绝
   - 后台接口：
     - `GET /api/admin/trades/overview`
     - `GET /api/admin/trades/session-status`

3. AU9999 行情 provider + fallback
   - 接口：`GET /api/app/market/au9999/ticker`
   - 环境变量：
     - `MARKET_TICKER_URL`
     - `MARKET_TICKER_API_KEY`
   - 降级顺序：
     - 实时 provider
     - `system_config` 行情缓存
     - 最新成交价
     - 本地默认价
   - 返回要求：
     - 价格精度固定 `0.01`
     - 返回 `source`、`timestamp`、`refreshSeconds`
     - 行情失败写错误日志，接口仍可降级返回

4. 后台风控写接口
   - 接口：
     - `POST /api/admin/users/:uid/freeze`
     - `POST /api/admin/users/:uid/unfreeze`
     - `POST /api/admin/trades/pause`
     - `POST /api/admin/trades/resume`
   - 要求：管理员鉴权
   - 同步写入：
     - `admin_operation_log`
     - `audit_log`
     - `hash_record`

5. 验证命令

```powershell
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 排行榜治理闭环 V1

`leaderboard` 模块当前已落地的排行榜治理口径如下：

1. 排行榜聚合读接口
   - 接口：`GET /api/admin/leaderboard`
   - 入参：
     - `uid`
     - `sortRule(goldHoldingGrams|totalAsset)`
     - `syncStatus(synced|exception|rebuilding)`
     - `timeRange(today|7d|30d)`
   - 返回：
     - `rows`
     - `monitors`
   - 排序规则：
     - `goldHoldingGrams` 按持金克数降序
     - `totalAsset` 按总资产降序
     - 同值时按 `uid` 升序，保证稳定顺序

2. 排行榜治理操作
   - 接口：
     - `POST /api/admin/leaderboard/rule`
     - `POST /api/admin/leaderboard/rebuild`
     - `POST /api/admin/leaderboard/retry-sync`
   - 要求：管理员鉴权
   - 留痕：
     - `admin_operation_log`
     - `audit_log`
     - `hash_record(SHA-256 64 位)`

3. 排行榜持久化结构
   - `LeaderboardConfig`
     - 保存当前生效规则
   - `LeaderboardJob`
     - 保存最近一次重排任务状态，状态为 `REBUILDING / SYNCED / FAILED`
   - `LeaderboardSnapshot`
     - 保存排行榜快照数据，包括 `rank / uid / goldHoldingGrams / totalAsset / updatedAt / syncStatus`

4. 排行榜同步与异常修复
   - 快照重建后会生成独立版本号
   - 快照同步异常会落到 `FAILED` 状态并在监控面板展示
   - `retry-sync` 会触发新的重建任务，用于修复异常状态

5. 验证命令

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 权限与风控-RBAC 闭环 V1

`admin-auth`、`risk`、`fund`、`leaderboard` 模块当前已落地的 RBAC 与风控配置口径如下：

1. 后台角色与权限管理
   - 接口：
     - `GET /api/admin/security/admin-users`
     - `GET /api/admin/security/roles`
     - `GET /api/admin/security/permissions`
     - `POST /api/admin/security/admin-users/:adminUserId/roles`
     - `POST /api/admin/security/roles/:roleId/permissions`
   - 行为：
     - 管理员角色分配采用覆盖式更新
     - 角色权限分配采用覆盖式更新
     - 每次变更都写入 `admin_operation_log`、`audit_log`、`hash_record`

2. 接口级权限拦截
   - 新增：
     - `@AdminPermission(...)`
     - `AdminPermissionGuard`
   - 规则：
     - 敏感接口必须通过 JWT 鉴权和权限码校验
     - 请求中的 token 权限声明不作为最终依据
     - 每次权限判断都以数据库实时角色权限为准，避免脏权限
   - 当前已接入权限校验的敏感操作：
     - 冻结 / 解冻用户
     - 停盘 / 恢复交易
     - 手工转账 / 手工补款
     - 排行榜规则更新 / 重建 / 重试
     - 风控规则查询 / 更新

3. 风控规则结构化落库
   - 表：
     - `RiskRuleConfig`
     - `RiskBlacklistUid`
   - 接口：
     - `GET /api/admin/risk/rules`
     - `POST /api/admin/risk/rules`
   - 当前规则字段：
     - `withdrawInterceptEnabled`
     - `singleWithdrawalLimit`
     - `dailyWithdrawalLimit`
     - `abnormalTradeThreshold`
     - `blacklistUids`

4. 默认权限初始化
   - 迁移会补齐后台默认权限码
   - 新增 `SUPER_ADMIN` 角色并授予全部治理权限
   - 对当前没有任何角色的管理员，自动补一个默认超级管理员角色，避免升级后权限全失效

5. 验证命令

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 资金与交易并发安全加固 V1

`fund`、`trade` 与 `common` 当前已补齐的并发与幂等安全口径如下：

1. 提现与后台资金操作防重复
   - 覆盖接口：
     - `POST /api/admin/funds/withdrawals/:orderId/approve`
     - `POST /api/admin/funds/withdrawals/:orderId/reject`
     - `POST /api/admin/funds/withdrawals/:orderId/confirm-completed`
     - `POST /api/admin/funds/manual-transfer`
     - `POST /api/admin/funds/manual-adjust`
   - 机制：
     - 所有资金关键路径都在 `Prisma.TransactionIsolationLevel.Serializable` 事务内完成
     - 订单状态变更与资产变更使用条件更新，避免重复扣减或重复回补
     - 同一订单重复点击只允许一次成功，其余返回已处理结果或 `409 Conflict`
   - 留痕：
     - `admin_operation_log`
     - `audit_log`
     - `hash_record(SHA-256 64 位)`

2. 买卖提交幂等化
   - 覆盖接口：
     - `POST /api/app/trades/buy`
     - `POST /api/app/trades/sell`
   - 幂等键来源：
     - 优先请求头 `Idempotency-Key`
     - 其次请求体 `clientRequestId`
   - 规则：
     - 相同幂等键 + 相同请求体重复提交时，返回同一业务结果
     - 相同幂等键但请求体不一致时，返回冲突错误
     - 请求正在处理中时，重复提交返回 `409 Conflict`

3. 队列号与持久化保障
   - `WithdrawalOrder.queueNo` 已改为数据库原生自增并唯一
   - 新增 `OperationIdempotency` 表，记录：
     - `key`
     - `scope`
     - `requestHash`
     - `responsePayload`
     - `status`
     - `traceId`
   - 作用：
     - 防止交易重复落单
     - 防止后台手工转账 / 补款重复记账
     - 为幂等命中、失败恢复和冲突排查提供依据

4. 资产安全约束
   - 应用层对以下字段做非负强校验：
     - `tentativeAsset`
     - `cashAsset`
     - `withdrawFrozenAmount`
     - `goldHoldingGrams`
   - 数据库层同步增加非负 `CHECK` 约束，避免并发边界下写入脏数据
   - 高频查询补充索引：
     - `WithdrawalOrder(status, submittedAt)`
     - `LedgerEntry(referenceType, referenceId)`
     - `TradeOrder(userId, submittedAt)`
     - `TradeOrder(status, submittedAt)`

5. 验证命令

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 审计导出 + 报表任务化导出 V1

`audit` 与 `report` 模块当前已落地的导出闭环口径如下：

1. 审计 trace 追溯增强
   - 接口：
     - `GET /api/admin/audit/trace/:traceId`
     - `POST /api/admin/audit/trace/:traceId/verify-hash`
     - `GET /api/admin/audit/trace/:traceId/export?format=csv|json`
   - 能力：
     - 返回 trace 的全链路节点，包括资金、交易、风控、后台操作、账本节点、hash 节点和同步状态
     - `verify-hash` 返回 `passed / failedCount / failedItems`
     - `export` 返回文件元信息和可直接下载的内容，CSV 可用，JSON 同步可用
   - 留痕：
     - `admin_operation_log`
     - `audit_log`
     - `hash_record(SHA-256 64 位)`

2. 报表中心任务化导出
   - 接口：
     - `POST /api/admin/reports/generate`
     - `GET /api/admin/reports/jobs`
     - `GET /api/admin/reports/jobs/:jobId`
     - `POST /api/admin/reports/jobs/:jobId/export`
     - `POST /api/admin/reports/templates`
     - `GET /api/admin/reports/templates`
   - 规则：
     - `reportType` 支持 `operate / finance / risk`
     - 支持 `timeRange / uid / channel` 过滤
     - 任务状态为 `PENDING / RUNNING / SUCCEEDED / FAILED`
     - CSV 为当前正式可用导出格式
     - Excel 当前先保留接口字段和占位产物，便于前端联调
   - 模板：
     - 模板持久化到 `ReportTemplate`
     - 生成任务可直接复用模板内的筛选条件和默认格式

3. 报表持久化结构
   - `ReportTemplate`
     - 保存模板名称、报表类型、过滤条件、默认导出格式
   - `ReportJob`
     - 保存任务状态、筛选条件、请求格式、traceId、行数、错误信息
   - `ReportArtifact`
     - 保存任务导出产物，包括格式、文件名、MIME、内容、traceId

4. 索引与查询优化
   - 报表任务：
     - `ReportJob(status, createdAt)`
     - `ReportJob(reportType, createdAt)`
   - 导出产物：
     - `ReportArtifact(jobId)`
   - 审计 trace 查询：
     - `AuditLog(traceId, createdAt)`
     - `AdminOperationLog(traceId, createdAt)`
     - `HashRecord(traceId, createdAt)`
     - `LedgerEntry(traceId, createdAt)`

5. 验证命令

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 增值收益二维码支付闭环 V1

`payment` 模块当前已落地的二维码支付口径如下：

1. 支付资金来源限制
   - 支付接口：`POST /api/app/payments/transfer`
   - 只允许使用 `appreciationIncome`
   - 严禁动用：
     - `cashAsset`
     - `tentativeAsset`
   - 支付成功后：
     - 付款方 `appreciationIncome`、`totalAsset` 同步减少
     - 收款方 `appreciationIncome`、`totalAsset` 同步增加

2. 收款二维码
   - 接口：`GET /api/app/payments/qr?uid=...`
   - 返回：
     - `qrPayload`
     - `displayName`
     - 固定文案：`金链·GYC  法币锚定金银结算系统。`

3. 支付记录与后台查询
   - App：
     - `GET /api/app/payments/records?uid=...&timeRange=...`
     - 返回支付与收款两类记录
   - Admin：
     - `GET /api/admin/payments`
     - `GET /api/admin/payments/overview`
   - 后台总览包含：
     - 总笔数
     - 总金额
     - 异常笔数
     - 近 24 小时趋势

4. 幂等、事务与留痕
   - 支持：
     - 请求头 `Idempotency-Key`
     - 请求体 `clientRequestId`
   - 相同幂等键重复请求不得重复扣款
   - 事务隔离级别：`Serializable`
   - 同事务写入：
     - `ledger_entry`
     - `audit_log`
     - `hash_record(SHA-256 64 位)`

5. 持久化结构
   - `PaymentProfile`
     - 保存用户收款二维码基础信息
   - `PaymentOrder`
     - 保存支付订单、traceId、付款方、收款方、金额、场景、状态、幂等键
   - 索引：
     - `PaymentOrder(traceId unique)`
     - `PaymentOrder(idempotencyKey unique)`
     - `PaymentOrder(payerId, createdAt)`
     - `PaymentOrder(payeeId, createdAt)`
     - `PaymentOrder(status, createdAt)`

6. 验证命令

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend run test -- --runInBand
```

## 开发软件

推荐你本地准备这些工具：

- Node.js 22 LTS
- Docker Desktop
- DBeaver
- Apifox
- VS Code
- Git
