# admin-auth 模块测试用例

## 1. 管理员登录测试

### 用例基础信息
- **用例ID**: ADMIN-AUTH-001
- **模块**: admin-auth
- **接口**: POST /admin/auth/login
- **优先级**: P0
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **数据库初始状态**: 管理员账号已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /admin/auth/login
- **Headers**:
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
- **Body**:
  ```json
  {
    "username": "admin",
    "password": "password123"
  }
  ```

### 预期响应断言
- **HTTP状态码**: 200
- **响应体**:
  ```json
  {
    "code": 0,
    "message": "success",
    "traceId": "${x-trace-id}",
    "data": {
      "accessToken": "${jwt_token}",
      "admin": {
        "id": "${admin_id}",
        "username": "admin"
      }
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回新的token
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，登录操作不产生持久化数据

## 2. 管理员权限验证测试

### 用例基础信息
- **用例ID**: ADMIN-AUTH-002
- **模块**: admin-auth
- **接口**: GET /admin/users
- **优先级**: P0
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在用户数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /admin/users
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - x-trace-id: 随机生成的trace ID

### 预期响应断言
- **HTTP状态码**: 200
- **响应体**:
  ```json
  {
    "code": 0,
    "message": "success",
    "traceId": "${x-trace-id}",
    "data": {
      "users": [
        {
          "id": "${user_id}",
          "username": "${username}",
          "status": "active"
        }
      ],
      "total": 1
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的用户列表
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 3. JWT 令牌生成与验证测试

### 用例基础信息
- **用例ID**: ADMIN-AUTH-003
- **模块**: admin-auth
- **接口**: POST /admin/auth/refresh
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 管理员账号已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /admin/auth/refresh
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - x-trace-id: 随机生成的trace ID

### 预期响应断言
- **HTTP状态码**: 200
- **响应体**:
  ```json
  {
    "code": 0,
    "message": "success",
    "traceId": "${x-trace-id}",
    "data": {
      "accessToken": "${new_jwt_token}"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回新的token
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，刷新token操作不产生持久化数据