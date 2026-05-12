# 其他功能

增强您在 VS Code 中 API 测试工作流的附加功能。

## CodeLens 集成

ApiMate 可以检测代码中的 API 路由，并显示 **Send Request** CodeLens 操作：

- 检测 Express、Fastify、Koa 等框架中的路由
- 在检测到的路由上方显示可点击的 "Send Request" 链接
- 点击后在 ApiMate 编辑器中打开请求
- 通过 `apimate.enableCodeLens` 设置启用/禁用

### 支持的框架

| 框架 | 检测模式 |
|------|----------|
| Express | `app.get('/path', ...)`, `router.post('/path', ...)` |
| Fastify | `fastify.get('/path', ...)` |
| Koa | `router.get('/path', ...)` |
| NestJS | `@Get('path')`, `@Post('path')` |

### 示例

在您的代码中：

```typescript
app.get('/api/users', (req, res) => {
    // Send Request  <-- CodeLens 出现在此处
    res.json({ users: [] });
});
```

## Cookie 管理

ApiMate 提供了 Cookie 管理器，用于查看和管理 Cookie：

- **查看 Cookie**：查看响应设置的所有 Cookie
- **Cookie 属性**：名称、值、域名、路径、过期时间、httpOnly、secure
- **清除 Cookie**：移除所有已存储的 Cookie
- 通过命令面板访问：ApiMate: Cookie Manager

## Git 友好的存储

所有 ApiMate 数据以 JSON 文件形式存储在工作区中：

```
.vscode/
  apimate/
    collections.json      # 集合和请求数据
    environments.json     # 环境配置
    global.json           # 全局变量
    history.json          # 请求历史
```

### 优势

- **版本控制**：将 `.vscode/apimate/` 添加到 Git 以实现团队共享
- **冲突解决**：JSON 文件易于合并
- **可移植性**：复制目录即可共享配置
- **备份**：简单的基于文件的备份

### .gitignore 注意事项

仅共享集合和环境，不共享历史记录：

```plaintext
.vscode/apimate/history.json
```

保持所有内容私有：

```plaintext
.vscode/apimate/
```

## 文件监视器

ApiMate 会监视存储目录的外部变更：

- 当 JSON 文件被外部修改时（例如团队成员通过 Git pull 更新），ApiMate 会自动重新加载数据
- 大多数情况下无需手动刷新
- 使用 **Refresh** 按钮或命令面板 > ApiMate: Refresh Data 进行手动重新加载

## VS Code 主题集成

ApiMate 与 VS Code 的主题系统集成：

- **浅色主题**：针对浅色背景优化的颜色和对比度
- **深色主题**：针对深色背景优化的颜色和对比度
- **高对比度**：增强可见性以提升无障碍体验
- UI 元素自动适配您当前激活的 VS Code 主题

## 数据安全

### 密钥变量加密

- 密钥变量使用 VS Code 的 SecretStorage API 存储
- 值在操作系统级别加密（macOS 使用 Keychain，Windows 使用 Credential Manager，Linux 使用 libsecret）
- 密钥值永远不会以明文形式存储在 JSON 文件中
- 导出环境时，密钥值会被替换为占位符

### SSL/TLS

- 默认启用 SSL 证书验证
- 可通过 `apimate.validateSSL` 禁用，用于使用自签名证书的本地开发
- 支持 TLS 1.2 及以上版本
