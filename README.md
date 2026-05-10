<p align="center">
  <img src="resources/icon.png" alt="ApiMate Logo" width="128" height="128" />
</p>

<h1 align="center">ApiMate</h1>

<p align="center">
  <strong>A full-featured API testing extension for VS Code</strong>
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#中文">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vscode-1.85%2B-blue?logo=visualstudiocode&logoColor=white" alt="VS Code" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/version-0.0.4-orange" alt="Version" />
</p>

---

![](resources/01.png)

![](resources/02.png)

<a id="english"></a>

## Features

### HTTP Request Editor

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Request Methods & URL</summary>

- Support all HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- URL input with environment variable auto-completion (`{{variable_name}}`)
- Query parameters editor with key-value pairs, auto-add new row on input
- URL auto-encodes special characters

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Request Headers</summary>

- Key-value header editor with auto-add new row
- Common headers quick-insert (Content-Type, Authorization, etc.)
- Headers with environment variable support

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Request Body</summary>

- JSON body with syntax highlighting and formatting
- Form-urlencoded body editor
- Multipart form-data with file upload support
- Raw body editor (text, XML, HTML)
- GraphQL query editor

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Authentication</summary>

- Basic Auth (username/password)
- Bearer Token
- API Key (header/query)
- OAuth 2.0 (authorization code, client credentials, implicit)
- AWS Signature V4
- Digest Auth
- Hawk Authentication
- NTLM Authentication

</details>

### Response Viewer

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Response Display</summary>

- Response body with syntax highlighting (JSON, XML, HTML, etc.)
- Response headers viewer
- Response status code with color indicator
- Response time display
- Response size display
- Cookie viewer

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Response Actions</summary>

- Copy response body
- Save response to file
- Export as cURL command
- Pretty print / Raw toggle

</details>

### Collections

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Collection Management</summary>

- Create, rename, delete collections
- Organize requests into folders (multi-level nesting)
- Drag-and-drop reordering
- Copy folders and requests
- Save requests to collections from editor
- Export collections as JSON

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Collection Runner</summary>

- Run entire collections sequentially or in parallel
- Iteration data support (CSV/JSON data-driven testing)
- Configurable max parallel requests
- Pre-request and post-response scripts per request
- Test results with pass/fail indicators

</details>

### Environment Variables

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Environment Management</summary>

- Create multiple named environments (e.g., Development, Staging, Production)
- Global variables shared across all environments
- Environment variables override global variables when names conflict
- Secret variable type with masked display and VS Code SecretStorage encryption
- Quick toggle between secret/default variable type
- Variable resolution preview showing merged result
- Inherited global variables displayed in environment detail with override indicators
- Duplicate, rename environments
- Import from .env files (auto-detect sensitive variable names)
- Import/export as JSON
- Activate environment with one click

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Variable Resolution</summary>

- Use `{{variable_name}}` syntax in URL, headers, body, query params
- Resolution priority: Local > Iteration Data > Environment > Collection > Global
- Recursive resolution (nested variables) up to 10 levels deep
- Dynamic variables: `$timestamp`, `$randomInt`, `$guid`, `$randomString`, `$faker.*`
- Unresolved variables preserved as-is

</details>

### Import & Export

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Import Formats</summary>

- Postman Collection (v2.1)
- OpenAPI / Swagger (v3.0)
- cURL command (with raw URL mode)
- HAR (HTTP Archive)
- .env files (auto-parse, auto-detect sensitive keys)
- JSON environment files

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Export Formats</summary>

- Export collections as JSON
- Export environments as JSON
- Export requests as cURL commands
- Save responses to files

</details>

### Scripts & Testing

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Pre/Post Scripts</summary>

- Pre-request scripts: modify request before sending
- Post-response scripts: process response after receiving
- `pm` API compatible with Postman scripting
- `pm.environment.get/set`, `pm.globals.get/set`
- `pm.request.headers.add`, `pm.request.body.raw`
- `pm.response.json()`, `pm.response.code`

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Test Assertions</summary>

- Chai.js assertion syntax
- `pm.test()` for structured test cases
- Status code, body, header assertions
- JSON path assertions
- Response time assertions

</details>

### Multi-Protocol Support

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Protocols</summary>

- HTTP/HTTPS (all methods)
- gRPC (unary, server streaming, client streaming, bidirectional)
- WebSocket (connect, send messages, view frames)
- Server-Sent Events (SSE)

</details>

### History

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Request History</summary>

- Auto-save request history
- Pin important requests
- Search and filter history
- Re-send from history
- Clear history

</details>

### Other Features

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> Additional</summary>

- CodeLens: detect API routes in code and show "Send Request" action
- Cookie management (view, clear)
- Git-friendly storage: data saved as JSON in `.vscode/apimate/`
- File watcher: auto-reload when files change externally
- Keyboard shortcuts
- VS Code theme integration

</details>

## Quick Start

1. Install the extension from VS Code Marketplace
2. Click the ApiMate icon in the Activity Bar
3. Create a new collection or import an existing one
4. Start testing your APIs!

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+N` | New Request |
| `Ctrl+Alt+S` | Send Request |
| `Ctrl+Alt+E` | Switch Environment |

## Configuration

Search for `apimate` in VS Code Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `apimate.requestTimeout` | 30000 | Request timeout (ms) |
| `apimate.followRedirects` | true | Follow HTTP redirects |
| `apimate.maxRedirects` | 5 | Max redirect count |
| `apimate.validateSSL` | true | Validate SSL certificates |
| `apimate.historyLimit` | 100 | Max history entries |
| `apimate.autoSave` | true | Auto-save to history |
| `apimate.prettyPrintResponses` | true | Format JSON/XML responses |
| `apimate.enableCodeLens` | true | Enable CodeLens in editors |
| `apimate.defaultEnvironment` | "" | Auto-activate environment ID |
| `apimate.storagePath` | ".vscode/apimate" | Data storage path |
| `apimate.scriptTimeout` | 5000 | Script timeout (ms) |
| `apimate.maxParallel` | 5 | Max parallel requests in collection run |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<a id="中文"></a>

## 功能特�?
### HTTP 请求编辑�?
<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 请求方法�?URL</summary>

- 支持所�?HTTP 方法：GET、POST、PUT、DELETE、PATCH、HEAD、OPTIONS
- URL 输入支持环境变量自动补全（`{{变量名}}`�?- Query 参数编辑器，键值对形式，输入即自动新增�?- URL 自动编码特殊字符

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 请求�?/summary>

- 键值对编辑器，输入即自动新增行
- 常用请求头快速插入（Content-Type、Authorization 等）
- 请求头支持环境变�?
</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 请求�?/summary>

- JSON 请求体，语法高亮和格式化
- x-www-form-urlencoded 编辑�?- Multipart form-data，支持文件上�?- Raw 编辑器（text、XML、HTML�?- GraphQL 查询编辑�?
</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 认证系统</summary>

- Basic Auth（用户名/密码�?- Bearer Token
- API Key（Header/Query�?- OAuth 2.0（授权码、客户端凭证、隐式）
- AWS Signature V4
- Digest Auth
- Hawk Authentication
- NTLM Authentication

</details>

### 响应查看�?
<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 响应展示</summary>

- 响应体语法高亮（JSON、XML、HTML 等）
- 响应头查看器
- 响应状态码颜色指示
- 响应时间显示
- 响应大小显示
- Cookie 查看�?
</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 响应操作</summary>

- 复制响应�?- 保存响应到文�?- 导出�?cURL 命令
- 格式�?/ 原始切换

</details>

### 集合管理

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 集合操作</summary>

- 创建、重命名、删除集�?- 将请求组织到文件夹中（多级嵌套）
- 拖拽排序
- 复制文件夹和请求
- 从编辑器保存请求到集�?- 导出集合�?JSON

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 集合运行�?/summary>

- 顺序或并行运行整个集�?- 迭代数据支持（CSV/JSON 数据驱动测试�?- 可配置最大并发请求数
- 每个请求的前置和后置脚本
- 测试结果通过/失败指示

</details>

### 环境变量

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 环境管理</summary>

- 创建多个命名环境（如：开发、测试、生产）
- 全局变量在所有环境中共享
- 环境变量同名时覆盖全局变量
- Secret 变量类型，掩码显�?+ VS Code SecretStorage 加密存储
- 快速切�?secret/default 变量类型
- 变量解析预览，展示合并后的结�?- 环境详情中显示继承的全局变量，带覆盖指示�?- 复制、重命名环境
- �?.env 文件导入（自动检测敏感变量名�?- 导入/导出 JSON 格式
- 一键激活环�?
</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 变量解析</summary>

- �?URL、Headers、Body、Query 参数中使�?`{{变量名}}` 语法
- 解析优先级：Local > Iteration Data > Environment > Collection > Global
- 递归解析（嵌套变量）最�?10 �?- 动态变量：`$timestamp`、`$randomInt`、`$guid`、`$randomString`、`$faker.*`
- 未解析变量保留原�?
</details>

### 导入与导�?
<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 导入格式</summary>

- Postman Collection (v2.1)
- OpenAPI / Swagger (v3.0)
- cURL 命令（支�?Raw URL 模式�?- HAR（HTTP Archive�?- .env 文件（自动解析，自动检测敏�?key�?- JSON 环境文件

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 导出格式</summary>

- 导出集合�?JSON
- 导出环境�?JSON
- 导出请求�?cURL 命令
- 保存响应到文�?
</details>

### 脚本与测�?
<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 前置/后置脚本</summary>

- 前置脚本：发送请求前修改请求
- 后置脚本：收到响应后处理响应
- 兼容 Postman 脚本�?`pm` API
- `pm.environment.get/set`、`pm.globals.get/set`
- `pm.request.headers.add`、`pm.request.body.raw`
- `pm.response.json()`、`pm.response.code`

</details>

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 测试断言</summary>

- Chai.js 断言语法
- `pm.test()` 结构化测试用�?- 状态码、Body、Header 断言
- JSON Path 断言
- 响应时间断言

</details>

### 多协议支�?
<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 协议</summary>

- HTTP/HTTPS（所有方法）
- gRPC（一元、服务端流、客户端流、双向流�?- WebSocket（连接、发送消息、查看帧�?- Server-Sent Events (SSE)

</details>

### 历史记录

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 请求历史</summary>

- 自动保存请求历史
- 置顶重要请求
- 搜索和过滤历�?- 从历史重新发�?- 清空历史

</details>

### 其他功能

<details>
<summary><img src="https://raw.githubusercontent.com/vogadero/ApiMate/main/resources/icon.png" width="16" /> 更多</summary>

- CodeLens：在代码中检�?API 路由并显�?发送请�?操作
- Cookie 管理（查看、清除）
- Git 友好存储：数据以 JSON 保存�?`.vscode/apimate/`
- 文件监听：外部文件变更时自动重载
- 键盘快捷�?- VS Code 主题集成

</details>

## 快速开�?
1. �?VS Code 插件市场安装扩展
2. 点击活动栏中�?ApiMate 图标
3. 创建新集合或导入已有集合
4. 开始测试你�?API�?
## 快捷�?
| 快捷�?| 功能 |
|--------|------|
| `Ctrl+Alt+N` | 新建请求 |
| `Ctrl+Alt+S` | 发送请�?|
| `Ctrl+Alt+E` | 切换环境 |

## 配置�?
�?VS Code 设置中搜�?`apimate`�?
| 配置�?| 默认�?| 说明 |
|--------|--------|------|
| `apimate.requestTimeout` | 30000 | 请求超时时间（毫秒） |
| `apimate.followRedirects` | true | 自动跟随重定�?|
| `apimate.maxRedirects` | 5 | 最大重定向次数 |
| `apimate.validateSSL` | true | 验证 SSL 证书 |
| `apimate.historyLimit` | 100 | 历史记录最大数�?|
| `apimate.autoSave` | true | 自动保存到历�?|
| `apimate.prettyPrintResponses` | true | 格式�?JSON/XML 响应 |
| `apimate.enableCodeLens` | true | 启用 CodeLens |
| `apimate.defaultEnvironment` | "" | 自动激活环�?ID |
| `apimate.storagePath` | ".vscode/apimate" | 数据存储路径 |
| `apimate.scriptTimeout` | 5000 | 脚本超时时间（毫秒） |
| `apimate.maxParallel` | 5 | 集合运行最大并发数 |

## 许可�?
本项目基�?MIT 许可证授�?- 详见 [LICENSE](LICENSE) 文件�?