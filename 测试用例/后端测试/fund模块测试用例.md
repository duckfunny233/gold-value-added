# fund 模块测试用例

## 1. 资金账户查询测试

### 用例基础信息
- **用例ID**: FUND-001
- **模块**: fund
- **接口**: GET /fund/accounts
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 用户资金账户已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /fund/accounts
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
      "accounts": [
        {
          "id": "${account_id}",
          "type": "gold",
          "balance": 1000,
          "currency": "CNY"
        }
      ]
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的账户信息
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 2. 资金变动记录测试

### 用例基础信息
- **用例ID**: FUND-002
- **模块**: fund
- **接口**: GET /fund/transactions
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在资金变动记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /fund/transactions?page=1&pageSize=10&type=deposit
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
      "transactions": [
        {
          "id": "${transaction_id}",
          "type": "deposit",
          "amount": 500,
          "balance": 1500,
          "createdAt": "${timestamp}"
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
- **相同请求重复提交**: 每次返回相同的交易记录
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 3. 资金余额计算测试

### 用例基础信息
- **用例ID**: FUND-003
- **模块**: fund
- **接口**: GET /fund/balance
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 用户资金账户已存在
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /fund/balance?currency=CNY
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
      "balance": 1500,
      "currency": "CNY"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的余额信息
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据