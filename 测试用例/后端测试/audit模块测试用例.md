# audit 模块测试用例

## 1. 审计日志记录测试

### 用例基础信息
- **用例ID**: AUDIT-001
- **模块**: audit
- **接口**: POST /admin/audit/logs
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 审计日志表为空
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /admin/audit/logs
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "action": "user_login",
    "userId": "${user_id}",
    "details": {
      "ip": "127.0.0.1",
      "userAgent": "Mozilla/5.0"
    }
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
      "logId": "${log_id}"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - audit_log: 新增一条审计日志记录
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的logId，不重复创建记录
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的审计日志记录

## 2. 审计日志查询测试

### 用例基础信息
- **用例ID**: AUDIT-002
- **模块**: audit
- **接口**: GET /admin/audit/logs
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在审计日志记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /admin/audit/logs?page=1&pageSize=10&action=user_login
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
      "logs": [
        {
          "id": "${log_id}",
          "action": "user_login",
          "userId": "${user_id}",
          "details": {
            "ip": "127.0.0.1",
            "userAgent": "Mozilla/5.0"
          },
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
- **相同请求重复提交**: 每次返回相同的日志列表
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 3. 审计日志导出测试

### 用例基础信息
- **用例ID**: AUDIT-003
- **模块**: audit
- **接口**: GET /admin/audit/logs/export
- **优先级**: P2
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在审计日志记录
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /admin/audit/logs/export?startDate=2026-01-01&endDate=2026-12-31
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - x-trace-id: 随机生成的trace ID

### 预期响应断言
- **HTTP状态码**: 200
- **响应头**: 
  - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - Content-Disposition: attachment; filename="audit_logs.xlsx"
- **响应体**: Excel文件内容
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的Excel文件
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，导出操作不产生持久化数据