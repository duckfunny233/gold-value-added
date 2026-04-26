# dashboard 模块测试用例

## 1. 仪表盘数据统计测试

### 用例基础信息
- **用例ID**: DASHBOARD-001
- **模块**: dashboard
- **接口**: GET /dashboard/stats
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在用户、交易、资金等数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /dashboard/stats
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
      "userCount": 100,
      "tradeCount": 500,
      "totalVolume": 1000000,
      "activeUsers": 50
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回最新的统计数据
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 2. 新闻feed测试

### 用例基础信息
- **用例ID**: DASHBOARD-002
- **模块**: dashboard
- **接口**: GET /dashboard/news
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在新闻数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /dashboard/news?page=1&pageSize=10
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
      "news": [
        {
          "id": "${news_id}",
          "title": "Latest Market Update",
          "content": "Gold prices are rising...",
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
- **相同请求重复提交**: 每次返回相同的新闻列表
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 3. 活动记录测试

### 用例基础信息
- **用例ID**: DASHBOARD-003
- **模块**: dashboard
- **接口**: GET /dashboard/activities
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在用户活动记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /dashboard/activities?page=1&pageSize=10
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
      "activities": [
        {
          "id": "${activity_id}",
          "type": "trade",
          "description": "Trade executed successfully",
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
- **相同请求重复提交**: 每次返回相同的活动记录
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据