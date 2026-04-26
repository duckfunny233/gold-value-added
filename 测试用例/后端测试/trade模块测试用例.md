# trade 模块测试用例

## 1. 交易创建测试

### 用例基础信息
- **用例ID**: TRADE-001
- **模块**: trade
- **接口**: POST /trade/create
- **优先级**: P0
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 用户资金账户已存在，市场数据已更新
- **系统配置状态**: 系统正常运行，交易时段开启

### 请求定义
- **Method**: POST
- **URL**: /trade/create
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "symbol": "GOLD",
    "side": "buy",
    "amount": 10,
    "price": 1800
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
      "tradeId": "${trade_id}",
      "status": "pending",
      "amount": 10,
      "price": 1800
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - trade_order: 新增一条交易订单记录
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的tradeId，不重复创建订单
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的交易订单记录

## 2. 交易执行测试

### 用例基础信息
- **用例ID**: TRADE-002
- **模块**: trade
- **接口**: POST /trade/execute
- **优先级**: P0
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 系统
- **数据库初始状态**: 存在待执行的交易订单
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /trade/execute
- **Headers**:
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "tradeId": "${trade_id}"
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
      "executed": true,
      "tradeId": "${trade_id}",
      "status": "completed"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - trade_order: 更新交易订单状态
  - ledger_entry: 新增一条资金 ledger 记录
  - audit_log: 新增一条交易执行审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，状态保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除相关的交易订单、ledger记录和审计日志

## 3. 交易状态更新测试

### 用例基础信息
- **用例ID**: TRADE-003
- **模块**: trade
- **接口**: POST /trade/update-status
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在交易订单记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /trade/update-status
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "tradeId": "${trade_id}",
    "status": "cancelled",
    "reason": "User request"
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
      "tradeId": "${trade_id}",
      "status": "cancelled"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - trade_order: 更新交易订单状态
  - audit_log: 新增一条状态更新审计日志
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，状态保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除相关的交易订单和审计日志