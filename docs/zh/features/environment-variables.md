# 环境变量

环境变量是一项核心功能，允许你定义和切换不同的运行时上下文（例如开发、预发布、生产），而无需修改单个请求。

## 环境管理

![环境管理界面](/environment-manager.png)

### 创建环境

1. 在侧边栏点击 **Environment** 标签页
2. 点击 **New Environment**
3. 为环境命名（例如 "Development"、"Staging"、"Production"）
4. 以键值对形式添加变量

### 环境操作

| 操作 | 方法 |
|--------|-----|
| 创建 | 点击 "New Environment" |
| 重命名 | 右键 > Rename |
| 复制 | 右键 > Duplicate |
| 删除 | 右键 > Delete |
| 激活 | 点击环境名称或使用 `Ctrl+Alt+E` |
| 导出 | 右键 > Export as JSON |
| 导入 | 点击 "Import" 并选择 JSON 或 .env 文件 |

### 激活环境

- 在侧边栏点击环境名称来激活它
- 使用 `Ctrl+Alt+E` 打开环境切换器
- 当前激活的环境会高亮显示并在环境选择器中展示
- 同一时间只能激活一个环境

## 全局变量

![全局变量编辑器](/global-variables.png)

全局变量在所有环境之间共享：

- 在 Environment 标签页顶部的 **Global Variables** 部分定义
- 在每个请求中可用，不受当前激活环境影响
- **视觉区分**：全局变量为金色，环境变量为蓝色
- 当环境变量与全局变量同名时，环境变量优先

### 全局变量与环境变量对比

| 属性 | 全局变量 | 环境变量 |
|----------|-----------------|----------------------|
| 作用域 | 所有环境 | 特定环境 |
| 颜色标识 | 金色 | 蓝色 |
| 覆盖关系 | 被环境变量覆盖 | 覆盖全局变量 |
| 存储位置 | `.vscode/apimate/global.json` | `.vscode/apimate/environments.json` |

## 密钥变量

![密钥变量切换和掩码显示](/secret-variables.png)

密钥变量为 API 密钥和令牌等敏感数据提供安全存储：

- **掩码显示**：值在界面中显示为 `****`
- **VS Code SecretStorage 加密**：使用 VS Code 内置安全存储机制对值进行加密
- **快速切换**：一键在密钥和默认变量类型之间切换
- **自动检测**：导入 .env 文件时，包含 `key`、`secret`、`password`、`token`、`auth` 的敏感名称变量会自动标记为密钥

### 使用密钥变量

1. 添加变量并点击**锁图标**将其标记为密钥
2. 值将在界面中被掩码显示
3. 实际值存储在 VS Code SecretStorage 中，而非 JSON 文件中
4. 发送请求时，从 SecretStorage 中获取真实值

## 变量解析

### 在请求中使用变量

::: v-pre
在任何请求字段中使用 `{{variable_name}}` 语法：

- **URL**：`https://{{base_url}}/api/users`
- **请求头**：`Authorization: Bearer {{auth_token}}`
- **请求体**：`{"username": "{{username}}"}`
- **查询参数**：`?api_key={{api_key}}`
:::

### 解析优先级

变量按以下优先级顺序解析（从高到低）：

1. **局部变量** - 在当前请求脚本中定义的变量
2. **迭代数据** - 集合运行器数据文件中的变量
3. **环境变量** - 当前激活环境中的变量
4. **集合变量** - 在集合级别定义的变量
5. **全局变量** - 在所有环境之间共享的全局变量

当多个级别存在同名变量时，使用最高优先级的值。

### 递归解析

变量可以引用其他变量，ApiMate 会递归解析：

```
base_url = https://api.example.com
api_path = {{base_url}}/v2
endpoint = {{api_path}}/users
```

结果：`https://api.example.com/v2/users`

- 最大递归深度：**10 层**
- 检测并防止循环引用

### 动态变量

ApiMate 提供内置动态变量，在请求时生成值：

| 变量 | 说明 | 示例输出 |
|----------|-------------|----------------|
| `$timestamp` | 当前 Unix 时间戳 | `1699999999` |
| `$randomInt` | 随机整数（0-1000） | `427` |
| `$guid` | 随机 UUID v4 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `$randomString` | 随机字母数字字符串（8 个字符） | `k9Xm2pLq` |
| `$faker.firstName` | 随机名 | `John` |
| `$faker.lastName` | 随机姓 | `Smith` |
| `$faker.email` | 随机电子邮件地址 | `john.smith@example.com` |
| `$faker.phoneNumber` | 随机电话号码 | `555-123-4567` |
| `$faker.address` | 随机街道地址 | `123 Main St` |
| `$faker.city` | 随机城市名称 | `Springfield` |
| `$faker.country` | 随机国家名称 | `United States` |
| `$faker.companyName` | 随机公司名称 | `Acme Corp` |
| `$faker.url` | 随机 URL | `https://example.com/page` |
| `$faker.ip` | 随机 IPv4 地址 | `192.168.1.1` |

### 变量解析预览

![变量解析预览部分](/variable-preview.png)

环境详情视图包含**变量解析预览**部分，显示：

- 所有活动变量的合并视图（全局 + 环境）
- 哪些变量继承自全局作用域
- 哪些环境变量覆盖了全局变量
::: v-pre
- 示例 URL 解析，展示 `{{variable_name}}` 如何被替换
:::

### 未解析的变量

如果变量名无法从任何来源解析，它将在请求中保持原样：

::: v-pre
- `https://api.example.com/{{unknown_var}}` 将以 `https://api.example.com/{{unknown_var}}` 发送
:::

- 这有助于你识别缺失的变量定义

## 从 .env 文件导入

![.env 导入对话框](/import-env.png)

从 `.env` 文件导入环境变量：

1. 在环境部分点击 **Import**
2. 选择一个 `.env` 文件
3. ApiMate 自动解析文件并创建变量
4. 敏感变量名（包含 `key`、`secret`、`password`、`token`、`auth`）会自动标记为密钥

示例 `.env` 文件：
```bash
BASE_URL=https://api.example.com
API_KEY=sk-abc123def456
DB_PASSWORD=mysecretpassword
DEBUG=true
```

导入后：
- `BASE_URL` - 默认变量
- `API_KEY` - 密钥变量（自动检测）
- `DB_PASSWORD` - 密钥变量（自动检测）
- `DEBUG` - 默认变量
