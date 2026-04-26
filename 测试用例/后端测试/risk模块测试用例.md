# risk 模块测试用例

## 1. 风控规则验证测试

### 用例基础信息
- **用例ID**: RISK-001
- **模块**: risk
- **接口**: POST /risk/validate
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在风控规则配置
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /risk/validate
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "type": "trade",
    "amount": 10000,
    "userId": "${user_id}"
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
      "valid": true,
      "riskLevel": "low"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的验证结果
- **同key不同payload**: 409冲突

### 清理与回滚
- 无需清理，验证操作不产生持久化数据

## 2. 风险评估测试

### 用例基础信息
- **用例ID**: RISK-002
- **模块**: risk
- **接口**: POST /risk/assess
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在用户交易数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /risk/assess
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "userId": "${user_id}",
    "period": "7d"
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
      "riskScore": 85,
      "riskLevel": "medium",
      "recommendations": ["Monitor transaction patterns"]
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - risk_assessment: 新增一条风险评估记录
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的评估结果，不重复创建记录
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的风险评估记录

## 3. 风险预警测试

### 用例基础信息
- **用例ID**: RISK-003
- **模块**: risk
- **接口**: GET /risk/alerts
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在风险预警记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /risk/alerts?status=active&page=1&pageSize=10
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
      "alerts": [
        {
          "id": "${alert_id}",
          "type": "suspicious_transaction",
          "userId": "${user_id}",
          "severity": "high",
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
- **相同请求重复提交**: 每次返回相同的预警列表
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据