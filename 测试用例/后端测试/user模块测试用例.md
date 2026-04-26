# user 模块测试用例

## 1. 用户信息查询测试

### 用例基础信息
- **用例ID**: USER-001
- **模块**: user
- **接口**: GET /user/profile
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 用户信息已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /user/profile
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
      "id": "${user_id}",
      "username": "user1",
      "email": "user1@example.com",
      "status": "active"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的用户信息
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 2. 用户信息更新测试

### 用例基础信息
- **用例ID**: USER-002
- **模块**: user
- **接口**: PUT /user/profile
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 用户信息已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: PUT
- **URL**: /user/profile
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "email": "newemail@example.com",
    "phone": "13800138000"
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
      "updated": true,
      "user": {
        "id": "${user_id}",
        "email": "newemail@example.com",
        "phone": "13800138000"
      }
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - user: 更新用户信息
  - audit_log: 新增一条信息更新审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，信息保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后恢复用户原始信息

## 3. 用户状态管理测试

### 用例基础信息
- **用例ID**: USER-003
- **模块**: user
- **接口**: POST /admin/users/status
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 用户信息已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /admin/users/status
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "userId": "${user_id}",
    "status": "frozen",
    "reason": "Suspicious activity"
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
      "updated": true,
      "userId": "${user_id}",
      "status": "frozen"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - user: 更新用户状态
  - audit_log: 新增一条状态更新审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，状态保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后恢复用户原始状态