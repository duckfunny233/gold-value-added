# 金影子 Workspace

根目录现在只作为 workspace 管理层使用，负责统一脚本入口、文档入口和工程边界说明。

## 工程结构

- `frontend/app`
  - 用户端唯一前端工程
- `frontend/admin`
  - 后台端唯一前端工程
- `backend`
  - 后端唯一工程
- `docs`
  - 业务、架构、接口和迁移文档入口

## 根目录职责

- 提供统一运行命令
- 提供文档入口
- 不再承载用户端或后台端前端源码入口

## Workspace 命令

### 启动
```bash
npm run dev:app
npm run dev:admin
npm run dev:backend
npm run dev:mock
```

### 构建
```bash
npm run build:app
npm run build:admin
npm run build:backend
```

### 测试
```bash
npm run test:app
npm run test:backend
```

## 文档入口

- `docs/00-总览与术语.md`
- `docs/01-业务规则与账本模型.md`
- `docs/02-系统架构（前台+后台+账本）.md`
- `docs/03-后台管理系统功能清单.md`
- `docs/04-子代理拆分方案.md`
- `docs/05-MCP与技能建议.md`
- `docs/06-接口迁移映射（RAML到OpenAPI）.md`
- `docs/07-项目架构调整说明.md`
- `docs/openapi.yaml`

## 约束说明

- 根目录不是用户端前端工程
- 根目录不是后台端前端工程
- 用户端开发进入 `frontend/app`
- 后台开发进入 `frontend/admin`
- 后端开发进入 `backend`
