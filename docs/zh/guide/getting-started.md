# 快速入门

## 安装

1. 打开 VS Code
2. 进入扩展视图（`Ctrl+Shift+X` / `Cmd+Shift+X`）
3. 搜索 **ApiMate**
4. 点击 **安装**

或通过命令行安装：

```bash
code --install-install apimate-0.0.4.vsix
```

## 第一步

安装 ApiMate 后，你会在 VS Code 左侧的活动栏中看到 ApiMate 图标。点击它即可打开侧边栏面板。

### 创建你的第一个请求

1. 点击侧边栏中的 **+** 按钮，或使用快捷键 `Ctrl+Alt+N`
2. 选择 HTTP 方法（GET、POST、PUT、DELETE 等）
3. 输入请求 URL
4. 根据需要添加请求头、查询参数或请求体
5. 点击 **发送** 或使用 `Ctrl+Alt+S`

### 使用集合组织请求

1. 点击侧边栏中的 **新建集合** 按钮
2. 为集合命名
3. 将请求拖拽到集合中
4. 在集合内创建文件夹以进一步组织
5. 使用请求编辑器中的 **保存到集合** 按钮

### 设置环境

1. 点击侧边栏中的 **环境** 标签
2. 点击 **新建环境** 并命名（例如"开发环境"、"生产环境"）
3. 以键值对形式添加变量（例如 `base_url` = `http://localhost:3000`）
4. 在请求中使用 <span v-pre>`{{variable_name}}`</span> 语法
5. 一键切换环境或使用 `Ctrl+Alt+E`

## 快速参考

| 操作 | 方式 |
|------|------|
| 新建请求 | `Ctrl+Alt+N` 或点击侧边栏中的 + |
| 发送请求 | `Ctrl+Alt+S` 或点击发送按钮 |
| 切换环境 | `Ctrl+Alt+E` 或点击环境选择器 |
| 导入 cURL | 命令面板 > ApiMate: Import cURL |
| 导入集合 | 命令面板 > ApiMate: Import Collection |
| 查看历史 | 点击侧边栏中的历史标签 |

## 数据存储

ApiMate 将所有数据以 JSON 文件形式存储在工作区的 `.vscode/apimate/` 目录中。这意味着：

- 你的数据是**工作区专属的** — 每个项目都有独立的集合和环境
- 数据可以**版本控制** — 将 `.vscode/apimate/` 添加到 Git 仓库即可与团队共享
- 数据是**可移植的** — 复制该目录即可在不同机器间共享配置

你可以在 VS Code 设置中的 `apimate.storagePath` 自定义存储路径。
