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
- `trade`：买单、卖单、撮合规则入口
- `market`：AU9999 行情接口
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
4. 给 `audit` 接入 SHA-256 存证与链上同步状态
5. 接入 JWT、RBAC、Redis 队列和 WebSocket 实时广播

## 开发软件

推荐你本地准备这些工具：

- Node.js 22 LTS
- Docker Desktop
- DBeaver
- Apifox
- VS Code
- Git
