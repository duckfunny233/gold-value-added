# market 模块测试用例

## 1. 市场数据查询测试

### 用例基础信息
- **用例ID**: MARKET-001
- **模块**: market
- **接口**: GET /market/data
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在市场数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /market/data?symbol=GOLD&interval=1h
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
      "symbol": "GOLD",
      "interval": "1h",
      "prices": [
        {
          "timestamp": "${timestamp}",
          "open": 1800,
          "high": 1810,
          "low": 1790,
          "close": 1805
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
- **相同请求重复提交**: 每次返回相同的市场数据
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 2. 市场行情更新测试

### 用例基础信息
- **用例ID**: MARKET-002
- **模块**: market
- **接口**: POST /market/update
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在市场数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /market/update
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "symbol": "GOLD",
    "price": 1805,
    "timestamp": "${timestamp}"
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
      "symbol": "GOLD",
      "price": 1805
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - market_data: 更新市场数据
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，数据可能更新
- **同key不同payload**: 409冲突

### 清理与回滚
- 无需清理，更新操作是系统正常功能

## 3. 市场数据缓存测试

### 用例基础信息
- **用例ID**: MARKET-003
- **模块**: market
- **接口**: GET /market/cache/status
- **优先级**: P2
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在市场数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /market/cache/status
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
      "cacheStatus": "active",
      "cachedSymbols": ["GOLD", "SILVER"],
      "lastUpdated": "${timestamp}"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的缓存状态
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据