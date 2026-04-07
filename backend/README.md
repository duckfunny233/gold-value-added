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

## 开发软件

推荐你本地准备这些工具：

- Node.js 22 LTS
- Docker Desktop
- DBeaver
- Apifox
- VS Code
- Git
