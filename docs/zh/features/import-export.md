# 导入与导出

ApiMate 支持多种格式的数据导入和导出，方便从其他工具迁移和共享配置。

## 导入格式

### Postman 集合（v2.1）

导入从 Postman 导出的集合：

1. 在 Postman 中：File > Export > Collection v2.1（推荐）
2. 在 ApiMate 中：命令面板 > ApiMate: Import Collection
3. 选择导出的 JSON 文件

**支持的元素：**
- 文件夹和请求层级结构
- 请求方法、URL、请求头和请求体
- 前置脚本和测试脚本
- 身份认证配置
- 集合和文件夹级别的变量

### OpenAPI / Swagger（v3.0）

从 OpenAPI/Swagger 规范导入 API 定义：

1. 命令面板 > ApiMate: Import from OpenAPI/Swagger
2. 选择 JSON 或 YAML 文件

**支持的元素：**
- 所有 HTTP 方法和路径
- 请求参数（路径、查询、请求头、Cookie）
- 请求体模式
- 响应模式
- 安全方案（身份认证）

### cURL 命令

导入 cURL 命令快速创建请求：

1. 命令面板 > ApiMate: Import cURL
2. 粘贴 cURL 命令
3. 切换 **Raw URL** 模式可直接导入 URL
4. 点击 Import

**支持的 cURL 选项：**

| 选项 | 标志 | 说明 |
|--------|------|-------------|
| 方法 | `-X, --request` | HTTP 方法 |
| 请求头 | `-H, --header` | 请求头 |
| 数据 | `-d, --data` | 请求体 |
| 表单 | `-F, --form` | 表单数据 |
| URL | `--url` | 请求 URL |
| 不安全 | `-k, --insecure` | 跳过 SSL 验证 |
| 认证 | `-u, --user` | Basic 认证凭据 |

### HAR（HTTP Archive）

从 HAR 文件导入请求（浏览器网络导出）：

1. 命令面板 > ApiMate: Import from HAR
2. 选择 `.har` 文件

**支持的元素：**
- 请求方法、URL、请求头和请求体
- 响应数据（供参考）
- Cookie

### .env 文件

从 `.env` 文件导入环境变量：

1. 在 Environment 部分点击 **Import**
2. 选择一个 `.env` 文件
3. 敏感名称的变量会自动标记为密钥

详见[环境变量 > 从 .env 导入](/zh/features/environment-variables#import-from-env-files)。

### JSON 环境文件

导入从 ApiMate 或兼容工具导出的环境配置：

1. 在 Environment 部分点击 **Import**
2. 选择包含环境结构的 JSON 文件

## 导出格式

### 导出集合为 JSON

导出集合以与团队成员共享或备份：

1. 右键点击集合 > Export Collection
2. 选择保存位置
3. JSON 文件包含所有请求、文件夹、脚本和配置

**导出格式：**
```json
{
  "id": "collection-uuid",
  "name": "My API Collection",
  "folders": [
    {
      "id": "folder-uuid",
      "name": "Users",
      "requests": [...]
    }
  ],
  "requests": [...]
}
```

### 导出环境为 JSON

导出环境配置：

1. 右键点击环境 > Export as JSON
2. 选择保存位置
3. 密钥变量的值以掩码占位符形式导出

### 导出请求为 cURL

为任何请求生成 cURL 命令：

1. 右键点击请求 > Export as cURL
2. cURL 命令复制到剪贴板

**示例输出：**
```bash
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-token' \
  -d '{"Name": "John", "email": "john@example.com"}'
```

### 保存响应到文件

将响应体直接保存到文件：

1. 在响应查看器中点击 **Save** 按钮
2. 选择保存位置和文件名
3. 响应体以原始编码保存
