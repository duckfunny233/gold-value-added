# chat 模块测试用例

## 1. 消息发送测试

### 用例基础信息
- **用例ID**: CHAT-001
- **模块**: chat
- **接口**: POST /chat/messages
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在聊天会话
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: POST
- **URL**: /chat/messages
- **Headers**:
  - Authorization: Bearer ${jwt_token}
  - Content-Type: application/json
  - x-trace-id: 随机生成的trace ID
  - Idempotency-Key: 随机生成的幂等键
- **Body**:
  ```json
  {
    "conversationId": "${conversation_id}",
    "content": "Hello, how are you?"
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
      "messageId": "${message_id}",
      "content": "Hello, how are you?",
      "senderId": "${user_id}",
      "createdAt": "${timestamp}"
    }
  }
  ```
- **字段类型**: 验证响应字段类型正确
- **x-trace-id 回传**: 验证响应头中的x-trace-id与请求一致

### 副作用断言
- **变化的表**: 
  - chat_message: 新增一条消息记录
- **不变的表**: 其他表结构不变

### 幂等与重放断言
- **相同请求重复提交**: 返回相同的messageId，不重复创建消息
- **同key不同payload**: 409冲突

### 清理与回滚
- 测试完成后删除创建的消息记录

## 2. 消息接收测试

### 用例基础信息
- **用例ID**: CHAT-002
- **模块**: chat
- **接口**: GET /chat/messages
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在聊天消息
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /chat/messages?conversationId=${conversation_id}&page=1&pageSize=20
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
      "messages": [
        {
          "id": "${message_id}",
          "content": "Hello, how are you?",
          "senderId": "${user_id}",
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
- **相同请求重复提交**: 每次返回相同的消息列表
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据

## 3. 聊天历史记录测试

### 用例基础信息
- **用例ID**: CHAT-003
- **模块**: chat
- **接口**: GET /chat/conversations
- **优先级**: P1
- **用例类型**: 正向

### 前置条件
- **环境**: 测试环境
- **账号角色**: 普通用户
- **token**: 有效的用户JWT token
- **数据库初始状态**: 存在聊天会话和消息
- **系统配置状态**: 系统正常运行

### 请求定义
- **Method**: GET
- **URL**: /chat/conversations?page=1&pageSize=10
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
      "conversations": [
        {
          "id": "${conversation_id}",
          "name": "Test Conversation",
          "lastMessage": "Hello, how are you?",
          "lastMessageAt": "${timestamp}",
          "unreadCount": 0
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
- **相同请求重复提交**: 每次返回相同的会话列表
- **同key不同payload**: 不适用

### 清理与回滚
- 无需清理，查询操作不产生持久化数据