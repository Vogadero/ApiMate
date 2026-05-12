# Multi-Protocol Support

ApiMate supports multiple communication protocols beyond standard HTTP/HTTPS.

## HTTP/HTTPS

The primary protocol with full support for:

- All HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- HTTPS with optional SSL verification
- Custom headers, query parameters, and body types
- Authentication mechanisms
- Redirect following with configurable limits

See [HTTP Request Editor](/features/http-request) for complete documentation.

## gRPC

![gRPC request interface](/grpc-request.png)

ApiMate supports gRPC, a high-performance RPC framework using Protocol Buffers.

### Supported gRPC Modes

| Mode | Description |
|------|-------------|
| Unary | Single request, single response |
| Server Streaming | Single request, stream of responses |
| Client Streaming | Stream of requests, single response |
| Bidirectional Streaming | Stream of requests and responses simultaneously |

### Using gRPC

1. Create a new request and select **gRPC** as the protocol
2. Enter the gRPC server address (e.g., `localhost:50051`)
3. Provide the `.proto` file path or paste the protobuf definition
4. Select the service and method
5. Enter the request message as JSON
6. Click **Invoke** to send the gRPC call

### gRPC Metadata

- Add metadata (gRPC's equivalent of headers) as key-value pairs
- Common metadata: authentication tokens, tracing IDs

### gRPC Response

- Response displayed as formatted JSON
- Streaming responses show each message as it arrives
- Status code and status message displayed

## WebSocket

![WebSocket connection with message exchange](/websocket.png)

ApiMate provides a WebSocket client for testing real-time communication.

### Connecting

1. Create a new request and select **WebSocket** as the protocol
2. Enter the WebSocket URL (e.g., `ws://localhost:8080/ws` or `wss://echo.websocket.org`)
3. Add optional headers for authentication
4. Click **Connect** to establish the connection

### Sending Messages

- Enter message content in the text area
- Choose message type: **Text** or **Binary**
- Click **Send** to transmit the message
- Messages can be sent at any time while connected

### Connection Management

- **Connect**: Establish the WebSocket connection
- **Disconnect**: Close the connection gracefully
- **Clear**: Clear the frame history
- Connection status indicator (connected/disconnected/connecting)

## Server-Sent Events (SSE)

![SSE connection with event stream](/sse.png)

ApiMate supports Server-Sent Events for testing one-way server push communication.

### Connecting to SSE

1. Create a new request and select **SSE** as the protocol
2. Enter the SSE endpoint URL
3. Add optional headers (e.g., <span v-pre>`Authorization: Bearer {{token}}`</span>)
4. Click **Connect** to start receiving events

### SSE Features

- **Auto-reconnect**: Optionally reconnect when the connection drops
- **Last-Event-ID**: Automatically sends the last received event ID on reconnection
- **Event filtering**: Filter events by type
- **Clear events**: Clear the event history
