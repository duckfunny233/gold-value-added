# leaderboard 模块测试用例

## 1. 排行榜数据查询测试

### 用例基础信息
- **用例ID**: LEADERBOARD-001
- **模块**: leaderboard
- **接口**: GET /leaderboard
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在排行榜数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /leaderboard?type=volume&period=week
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
      "rankings": [
        {
          "rank": 1,
          "userId": "${user_id}",
          "username": "user1",
          "value": 100000
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
- **相同请求重复提交**: 每次返回相同的排行榜数据
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 2. 排行榜规则验证测试

### 用例基础信息
- **用例ID**: LEADERBOARD-002
- **模块**: leaderboard
- **接口**: GET /leaderboard/rules
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 排行榜规则已配置
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /leaderboard/rules
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
      "rules": [
        {
          "id": "${rule_id}",
          "type": "volume",
          "period": "week",
          "threshold": 10000
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
- **相同请求重复提交**: 每次返回相同的规则配置
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 3. 排行榜更新测试

### 用例基础信息
- **用例ID**: LEADERBOARD-003
- **模块**: leaderboard
- **接口**: POST /leaderboard/update
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
- **URL**: /leaderboard/update
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "type": "volume",
    "period": "week"
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
      "count": 100
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - leaderboard: 更新排行榜数据
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 成功执行，数据可能更新
- **同key不同payload**: 409冲突

### 清理与回滚
- 无需清理，更新操作是系统正常功能