# 金影子 Workspace - Agent Guidelines

本文件只描述根目录 workspace 管理方式。根目录不再承载前端业务入口。

## Workspace 命令

### 开发
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

## 工程边界

- `frontend/app`
  - 用户端唯一前端工程
- `frontend/admin`
  - 后台端唯一前端工程
- `backend`
  - 后端唯一工程
- `docs`
  - 文档入口

## 代理工作约束

- 不要再把根目录当作用户端前端工程运行
- 不要再把根目录当作后台端前端工程运行
- 用户端改动进入 `frontend/app`
- 后台端改动进入 `frontend/admin`
- 后端改动进入 `backend`

## Mock 服务位置

- Mock 服务源码：`frontend/app/mock/mock-server.js`
- 根目录统一启动命令：`npm run dev:mock`
