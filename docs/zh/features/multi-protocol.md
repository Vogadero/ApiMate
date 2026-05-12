# 多协议支持

ApiMate 支持标准 HTTP/HTTPS 之外的多种通信协议。

## HTTP/HTTPS

主要协议，完整支持：

- 所有 HTTP 方法（GET、POST、PUT、DELETE、PATCH、HEAD、OPTIONS）
- HTTPS，支持可选的 SSL 验证
- 自定义请求头、查询参数和请求体类型
- 认证机制
- 重定向跟随，支持可配置的限制

完整文档请参阅 [HTTP 请求编辑器](/zh/features/http-request)。

## gRPC

![gRPC 请求界面](/grpc-request.png)

ApiMate 支持 gRPC，一种使用 Protocol Buffers 的高性能 RPC 框架。

### 支持的 gRPC 模式

| 模式 | 说明 |
|------|------|
| Unary | 单次请求，单次响应 |
| Server Streaming | 单次请求，流式响应 |
| Client Streaming | 流式请求，单次响应 |
| Bidirectional Streaming | 双向流式请求和响应 |

### 使用 gRPC

1. 创建新请求并选择 **gRPC** 作为协议
2. 输入 gRPC 服务器地址（例如 `localhost:50051`）
3. 提供 `.proto` 文件路径或粘贴 protobuf 定义
4. 选择服务和方法
5. 以 JSON 格式输入请求消息
6. 点击 **Invoke** 发送 gRPC 调用

### gRPC 元数据

- 以键值对形式添加元数据（gRPC 中等同于请求头的概念）
- 常见元数据：认证令牌、追踪 ID

### gRPC 响应

- 响应以格式化 JSON 显示
- 流式响应在每条消息到达时实时显示
- 显示状态码和状态消息

## WebSocket

![WebSocket 连接与消息交换](/websocket.png)

ApiMate 提供了 WebSocket 客户端，用于测试实时通信。

### 建立连接

1. 创建新请求并选择 **WebSocket** 作为协议
2. 输入 WebSocket URL（例如 `ws://localhost:8080/ws` 或 `wss://echo.websocket.org`）
3. 添加可选的认证请求头
4. 点击 **Connect** 建立连接

### 发送消息

- 在文本区域输入消息内容
- 选择消息类型：**Text** 或 **Binary**
- 点击 **Send** 发送消息
- 连接期间可随时发送消息

### 连接管理

- **Connect**：建立 WebSocket 连接
- **Disconnect**：优雅地关闭连接
- **Clear**：清除帧历史记录
- 连接状态指示器（已连接/已断开/连接中）

## Server-Sent Events (SSE)

![SSE 连接与事件流](/sse.png)

ApiMate 支持 Server-Sent Events，用于测试单向服务器推送通信。

### 连接 SSE

1. 创建新请求并选择 **SSE** 作为协议
2. 输入 SSE 端点 URL
3. 添加可选请求头（例如 <span v-pre>`Authorization: Bearer {{token}}`</span>）
4. 点击 **Connect** 开始接收事件

### SSE 功能

- **自动重连**：连接断开时可选自动重新连接
- **Last-Event-ID**：重连时自动发送上次接收到的事件 ID
- **事件过滤**：按类型过滤事件
- **清除事件**：清除事件历史记录
