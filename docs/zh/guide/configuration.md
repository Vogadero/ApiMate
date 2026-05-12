# 配置

ApiMate 可以通过 VS Code 设置进行配置。使用 `Ctrl+,` 打开设置，然后搜索 `apimate`。

## 通用设置

### `apimate.requestTimeout`

- **类型**：`number`
- **默认值**：`30000`
- **范围**：1000 - 300000
- **说明**：HTTP 请求超时时间（毫秒）。当请求在指定时间内未收到响应时，将自动取消。对于响应较慢的 API 或大文件下载，可增大此值；若需快速检测无响应的服务，可减小此值。

### `apimate.followRedirects`

- **类型**：`boolean`
- **默认值**：`true`
- **说明**：是否自动跟随 HTTP 3xx 重定向响应。启用后，301/302/307/308 重定向将被自动跟随；禁用后，直接返回重定向响应，便于调试重定向链。

### `apimate.maxRedirects`

- **类型**：`number`
- **默认值**：`5`
- **范围**：0 - 20
- **说明**：启用 `followRedirects` 时允许的最大重定向次数。防止无限重定向循环。达到限制后，将返回最后的响应。

### `apimate.validateSSL`

- **类型**：`boolean`
- **默认值**：`true`
- **说明**：是否验证 HTTPS 请求的 SSL/TLS 证书。启用后，自签名或过期证书将导致错误；禁用后，可以使用自签名证书请求本地开发服务器，但存在安全风险。

## 历史记录设置

### `apimate.historyLimit`

- **类型**：`number`
- **默认值**：`100`
- **范围**：10 - 1000
- **说明**：保留的最大请求历史条目数。超出限制时，最早的未固定条目将被自动移除。已固定的条目不会被自动移除。

### `apimate.autoSave`

- **类型**：`boolean`
- **默认值**：`true`
- **说明**：发送请求后是否自动保存到历史记录。启用后，每次请求都会被记录；禁用后，需要手动保存。

## 显示设置

### `apimate.prettyPrintResponses`

- **类型**：`boolean`
- **默认值**：`true`
- **说明**：是否自动格式化 JSON/XML 响应内容。启用后，响应体会自动缩进以提高可读性；禁用后，显示原始紧凑格式，便于精确检查。

### `apimate.enableCodeLens`

- **类型**：`boolean`
- **默认值**：`true`
- **说明**：是否在代码编辑器中启用 API 路由检测的 CodeLens 提示。启用后，检测到的 API 路由上方会显示"发送请求"操作链接，允许你直接从代码中发送请求。

## 存储设置

### `apimate.storagePath`

- **类型**：`string`
- **默认值**：`".vscode/apimate"`
- **说明**：集合和环境数据的存储路径，相对于工作区根目录。数据以 JSON 文件形式保存在此目录中，可以进行版本控制以实现团队共享。更改此设置后需重新加载数据。

### `apimate.defaultEnvironment`

- **类型**：`string`
- **默认值**：`""`
- **说明**：启动时自动激活的环境 ID。留空则不自动激活任何环境。可以从侧边栏环境列表的右键菜单中复制环境 ID。

## 脚本与运行器设置

### `apimate.scriptTimeout`

- **类型**：`number`
- **默认值**：`5000`
- **范围**：1000 - 30000
- **说明**：集合运行期间前置请求脚本和后置响应脚本的超时时间（毫秒）。超过此时间的脚本将被强制终止，以防止无限循环或长时间阻塞。

### `apimate.maxParallel`

- **类型**：`number`
- **默认值**：`5`
- **范围**：1 - 100
- **说明**：集合运行期间的最大并发请求数。增大此值可加快运行速度但会增加服务器负载；减小此值则执行更温和。此设置与侧边栏中的集合运行器设置同步。

## 配置示例

添加到你的 `.vscode/settings.json`：

```json
{
  "apimate.requestTimeout": 60000,
  "apimate.followRedirects": true,
  "apimate.maxRedirects": 10,
  "apimate.validateSSL": false,
  "apimate.historyLimit": 200,
  "apimate.autoSave": true,
  "apimate.prettyPrintResponses": true,
  "apimate.enableCodeLens": true,
  "apimate.storagePath": ".vscode/apimate",
  "apimate.defaultEnvironment": "",
  "apimate.scriptTimeout": 10000,
  "apimate.maxParallel": 10
}
```
