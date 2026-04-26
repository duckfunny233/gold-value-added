# auth 模块测试用例

## 1. 用户登录测试

### 用例基础信息
- **用例ID**: AUTH-001
- **模块**: auth
- **接口**: POST /auth/login
- **优先级**: P0
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **数据库初始状态**: 用户账号已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /auth/login
- **Headers**:
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
- **Body**:
  ```json
  {
    "username": "user1",
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
      "user": {
        "id": "${user_id}",
        "username": "user1"
      }
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - audit_log: 新增一条登录审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回新的token
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，登录操作不产生持久化数据

## 2. 用户注册测试

### 用例基础信息
- **用例ID**: AUTH-002
- **模块**: auth
- **接口**: POST /auth/register
- **优先级**: P0
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 无
- **数据库初始状态**: 用户名不存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /auth/register
- **Headers**:
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "username": "newuser",
    "password": "password123",
    "email": "newuser@example.com"
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
      "userId": "${user_id}",
      "username": "newuser"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - user: 新增一条用户记录
  - audit_log: 新增一条注册审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的userId，不重复创建用户
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的用户记录

## 3. 密码重置测试

### 用例基础信息
- **用例ID**: AUTH-003
- **模块**: auth
- **接口**: POST /auth/reset-password
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **数据库初始状态**: 用户账号已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /auth/reset-password
- **Headers**:
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "email": "user1@example.com",
    "newPassword": "newpassword123"
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
      "message": "Password reset successfully"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - user: 更新用户密码
  - audit_log: 新增一条密码重置审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，密码保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后恢复用户原始密码