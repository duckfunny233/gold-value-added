# payment 模块测试用例

## 1. 支付请求处理测试

### 用例基础信息
- **用例ID**: PAYMENT-001
- **模块**: payment
- **接口**: POST /payment/create
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 用户资金账户已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /payment/create
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "amount": 1000,
    "currency": "CNY",
    "method": "alipay",
    "type": "deposit"
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
      "paymentId": "${payment_id}",
      "amount": 1000,
      "status": "pending",
      "paymentUrl": "${payment_url}"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - payment_order: 新增一条支付订单记录
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的paymentId，不重复创建订单
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的支付订单记录

## 2. 支付状态更新测试

### 用例基础信息
- **用例ID**: PAYMENT-002
- **模块**: payment
- **接口**: POST /payment/update-status
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在支付订单记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /payment/update-status
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "paymentId": "${payment_id}",
    "status": "completed",
    "transactionId": "${transaction_id}"
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
      "paymentId": "${payment_id}",
      "status": "completed"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - payment_order: 更新支付订单状态
  - ledger_entry: 新增一条资金 ledger 记录（如果是充值）
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，状态保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除相关的支付订单和ledger记录

## 3. 支付回调处理测试

### 用例基础信息
- **用例ID**: PAYMENT-003
- **模块**: payment
- **接口**: POST /payment/callback
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 系统
- **数据库初始状态**: 存在支付订单记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /payment/callback
- **Headers**:
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
- **Body**:
  ```json
  {
    "paymentId": "${payment_id}",
    "status": "completed",
    "transactionId": "${transaction_id}",
    "signature": "${signature}"
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
      "processed": true
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - payment_order: 更新支付订单状态
  - ledger_entry: 新增一条资金 ledger 记录（如果是充值）
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，状态保持不变
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除相关的支付订单和ledger记录