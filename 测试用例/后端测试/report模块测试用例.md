# report 模块测试用例

## 1. 报表生成测试

### 用例基础信息
- **用例ID**: REPORT-001
- **模块**: report
- **接口**: POST /report/generate
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在用户、交易、资金等数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /report/generate
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "type": "trade",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "format": "xlsx"
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
      "reportId": "${report_id}",
      "status": "generating"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - report_job: 新增一条报表生成任务记录
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的reportId，不重复创建任务
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的报表任务记录

## 2. 报表导出测试

### 用例基础信息
- **用例ID**: REPORT-002
- **模块**: report
- **接口**: GET /report/export
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在已生成的报表
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /report/export?reportId=${report_id}
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - x-trace-id: 随机生成的trace ID

### 预期响应断言
- **HTTP状态码**: 200
- **响应头**: 
  - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - Content-Disposition: attachment; filename="trade_report.xlsx"
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

## 3. 报表数据验证测试

### 用例基础信息
- **用例ID**: REPORT-003
- **模块**: report
- **接口**: GET /report/validate
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 管理员账号
- **token**: 有效的管理员JWT token
- **数据库初始状态**: 存在报表数据
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /report/validate?reportId=${report_id}
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
      "valid": true,
      "totalRecords": 100,
      "totalAmount": 1000000
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 无
- **不变的表**: 所有表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 每次返回相同的验证结果
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，验证操作不产生持久化数据