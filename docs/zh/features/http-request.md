# HTTP 请求编辑器

HTTP 请求编辑器是 ApiMate 的核心功能，提供了构建和发送 HTTP 请求的完整界面。

## 请求方法与 URL

![请求方法选择器和 URL 输入](/request-method-url.png)

### 支持的方法

ApiMate 支持所有标准 HTTP 方法：

| 方法 | 说明 |
|--------|-------------|
| GET | 获取资源 |
| POST | 创建资源 |
| PUT | 完整替换资源 |
| DELETE | 删除资源 |
| PATCH | 部分更新资源 |
| HEAD | 与 GET 相同，但不返回响应体 |
| OPTIONS | 描述通信选项 |

### URL 输入

- 在地址栏中输入完整的请求 URL
- **环境变量自动补全**：输入 <span v-pre>`{{`</span> 触发可用环境变量和全局变量的自动补全
- **特殊字符编码**：URL 自动编码 - 空格变为 `%20`，中文字符进行百分号编码等
- **查询字符串编辑**：URL 中的查询参数会自动解析并显示在下方的参数编辑器中

### 查询参数编辑器

![查询参数键值对编辑器](/query-params.png)

- 查询参数的键值对编辑器
- **自动添加新行**：在最后一行开始输入，会自动出现新的空行
- 通过复选框启用/禁用单个参数
- 参数与 URL 实时同步 - 编辑任一方，另一方自动更新

## 请求头

![请求头键值对编辑器与快捷插入](/request-headers.png)

### 请求头编辑器

- 请求头的键值对编辑器
- **自动添加新行**：在最后一行输入会自动创建新的空行
- 通过复选框启用/禁用单个请求头

### 快捷插入常用请求头

点击快捷插入按钮添加常用请求头：

| 请求头 | 值 |
|--------|-------|
| Content-Type | application/json |
| Content-Type | application/x-www-form-urlencoded |
| Content-Type | multipart/form-data |
| Authorization | Bearer token |
| Accept | application/json |
| Accept-Language | en-US |

### 请求头中的环境变量

::: v-pre
在请求头值中使用 `{{variable_name}}` 语法。例如：
- `Authorization: Bearer {{auth_token}}`
- `X-API-Key: {{api_key}}`
:::

变量在发送时使用当前激活的环境进行解析。

## 请求体

![请求体类型选择器和 JSON 编辑器](/request-body.png)

ApiMate 支持多种请求体类型，可通过标签页选择：

### JSON 请求体

- 具有语法高亮的全功能 JSON 编辑器
- **格式化按钮**：一键 JSON 格式化和验证
- **自动 Content-Type**：自动设置 `Content-Type: application/json`
- 支持嵌套对象和数组

### 表单 URL 编码

- `application/x-www-form-urlencoded` 数据的键值对编辑器
- **自动添加新行**：在最后一行输入会自动创建新的空行
- 通过复选框启用/禁用单个字段
- **自动 Content-Type**：自动设置 `Content-Type: application/x-www-form-urlencoded`

### Multipart 表单数据

- `multipart/form-data` 的键值对编辑器
- 支持**文本字段**和**文件上传**
- 点击文件类型切换按钮在文本和文件输入之间切换
- 文件字段显示文件选择对话框
- **自动 Content-Type**：自动设置带 boundary 的 `Content-Type: multipart/form-data`

### 原始请求体

- 用于原始请求体的纯文本编辑器
- 支持多种内容类型：
  - Text (text/plain)
  - XML (application/xml)
  - HTML (text/html)
- 需要手动设置 Content-Type 请求头

### GraphQL 查询编辑器

- 具有语法高亮的专用 GraphQL 查询编辑器
- **Query**、**Variables** 和 **Operation Name** 的独立面板
- **自动 Content-Type**：自动设置 `Content-Type: application/json`
- 支持 GraphQL 内省自动补全（当端点支持时）

## 身份认证

![认证类型选择器和认证配置](/authentication.png)

ApiMate 提供全面的身份认证支持。在 Auth 标签页的下拉菜单中选择认证类型。

### Basic 认证

- 输入**用户名**和**密码**
- 自动将凭据编码为 Base64 放入 `Authorization` 请求头
- 请求头格式：`Authorization: Basic base64(username:password)`

### Bearer Token

- 输入 **Token** 值
- 自动设置 `Authorization: Bearer <token>` 请求头
::: v-pre
- 支持环境变量：`{{auth_token}}`
:::

### API Key

- 配置**键名**和**值**
- 选择通过**请求头**或**查询参数**发送
- 示例：`X-API-Key: your-api-key`（请求头）或 `?api_key=your-api-key`（查询参数）

### OAuth 2.0

支持多种 OAuth 2.0 流程：

| 流程 | 使用场景 |
|------|----------|
| Authorization Code | 服务端 Web 应用 |
| Client Credentials | 机器间通信 |
| Implicit | 单页应用（旧版） |

配置选项：
- **Access Token URL**：令牌端点
- **Client ID**：应用客户端标识
- **Client Secret**：应用客户端密钥
- **Scope**：OAuth 范围字符串
- **Authorization URL**：Authorization Code 流程必需

### AWS Signature V4

- **Access Key**：AWS 访问密钥 ID
- **Secret Key**：AWS 秘密访问密钥
- **Region**：AWS 区域（例如 `us-east-1`）
- **Service**：AWS 服务名称（例如 `s3`、`execute-api`）
- 自动生成带 AWS Signature Version 4 的 `Authorization` 请求头

### Digest 认证

- 输入**用户名**和**密码**
- 实现 HTTP Digest 认证（RFC 7616）
- 自动处理质询-响应流程

### Hawk 认证

- **Auth ID**：Hawk 认证标识符
- **Auth Key**：Hawk 认证密钥
- **Algorithm**：SHA-256（默认）或 SHA-1
- 按照 Hawk 规范自动生成 `Authorization` 请求头

### NTLM 认证

- 输入**用户名**和**密码**
- 可选指定**域**
- 实现 NTLM 认证协议

## 导入 cURL

![cURL 导入对话框](/import-curl.png)

你可以导入 cURL 命令来创建请求：

1. 点击侧边栏中的 **Import cURL** 按钮或使用命令面板
2. 粘贴你的 cURL 命令
3. 如果你只想导入 URL，切换 **Raw URL** 模式
4. 点击 **Import** 创建请求

支持的 cURL 选项：
- `-X, --request` - HTTP 方法
- `-H, --header` - 请求头
- `-d, --data` - 请求体
- `-F, --form` - 表单数据
- `--url` - 请求 URL
- `-k, --insecure` - 跳过 SSL 验证
- `-u, --user` - Basic 认证凭据
