# 更新日志

## v0.0.4

ApiMate 初始发布版本。

### 功能特性

- **HTTP 请求编辑器**：支持所有 HTTP 方法、带环境变量自动补全的 URL、查询参数编辑器、多种请求体类型（JSON、form-urlencoded、multipart form-data、raw、GraphQL），以及全面的认证支持（Basic Auth、Bearer Token、API Key、OAuth 2.0、AWS Signature V4、Digest Auth、Hawk、NTLM）。
- **响应查看器**：语法高亮的响应体、响应头查看器、带颜色指示器的状态码、响应时间和大小显示、Cookie 查看器、复制/保存/导出操作。
- **集合**：创建、重命名、删除集合，支持多级文件夹嵌套、拖拽排序、复制文件夹和请求、将请求保存到集合、导出为 JSON。
- **集合运行器**：顺序或并行运行整个集合、迭代数据支持（CSV/JSON）、可配置的最大并行请求数、前置请求和后置响应脚本、带通过/失败指示器的测试结果。
- **环境变量**：多个命名环境、全局变量、使用 VS Code SecretStorage 加密的密钥变量类型、变量解析预览、带覆盖指示器的全局变量继承、从 .env 文件导入、以 JSON 导入/导出、一键激活。
- **变量解析**：在 URL、请求头、请求体和查询参数中使用 <span v-pre>`{{variable_name}}`</span> 语法；解析优先级（本地 > 迭代数据 > 环境 > 集合 > 全局）；最多 10 级递归解析；动态变量（`$timestamp`、`$randomInt`、`$guid`、`$randomString`、`$faker.*`）。
- **导入与导出**：从 Postman Collection（v2.1）、OpenAPI/Swagger（v3.0）、cURL、HAR 和 .env 文件导入；导出集合、环境和请求。
- **脚本与测试**：使用 `pm` API 的前置请求和后置响应脚本、Chai.js 断言、结构化测试用例。
- **多协议**：HTTP/HTTPS、gRPC（一元、服务端流、客户端流、双向流）、WebSocket、Server-Sent Events（SSE）。
- **历史记录**：自动保存请求历史、固定重要请求、搜索和过滤、从历史记录重新发送。
- **VS Code 集成**：API 路由检测的 CodeLens、键盘快捷键、主题集成、Git 友好的 JSON 存储、文件监视器自动重载。
