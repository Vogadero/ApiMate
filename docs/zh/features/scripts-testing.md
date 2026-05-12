# 脚本与测试

ApiMate 提供了强大的脚本引擎，用于自动化请求工作流和验证响应。

## 前置脚本

前置脚本在请求发送**之前**运行。可用于：

- 设置或修改变量
- 添加动态请求头
- 修改请求体
- 生成时间戳或签名
- 实现自定义认证逻辑

### 访问前置脚本编辑器

1. 在编辑器中打开一个请求
2. 点击 **Scripts** 标签页
3. 选择 **Pre-request Script**

### 示例：设置时间戳请求头

```javascript
pm.environment.set("timestamp", new Date().toISOString());
pm.request.headers.add({
    key: "X-Timestamp",
    value: pm.environment.get("timestamp")
});
```

### 示例：HMAC 签名

```javascript
const crypto = require('crypto');
const secret = pm.environment.get("api_secret");
const timestamp = Date.now().toString();
const method = pm.request.method;
const path = new URL(pm.request.url).pathname;
const message = method + path + timestamp;

const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

pm.request.headers.add({
    key: "X-Signature",
    value: signature
});
pm.request.headers.add({
    key: "X-Timestamp",
    value: timestamp
});
```

## 后置脚本

后置脚本在收到响应**之后**运行。可用于：

- 从响应中提取数据并保存到变量
- 使用断言验证响应数据
- 记录响应详情
- 通过设置变量来串联后续请求

### 访问后置脚本编辑器

1. 在编辑器中打开一个请求
2. 点击 **Scripts** 标签页
3. 选择 **Post-response Script**

### 示例：从登录响应中提取 Token

```javascript
const response = pm.response.json();
pm.environment.set("auth_token", response.token);
pm.environment.set("user_id", response.user.id);
```

### 示例：验证响应结构

```javascript
const response = pm.response.json();
pm.test("Response has required fields", function() {
    pm.expect(response).to.have.property("id");
    pm.expect(response).to.have.property("name");
    pm.expect(response).to.have.property("email");
});
```

## pm API 参考

`pm` 对象提供了对请求、响应和环境数据的访问。

### 环境变量与全局变量

| 方法 | 说明 |
|------|------|
| `pm.environment.get("key")` | 从当前环境获取变量 |
| `pm.environment.set("key", "value")` | 在当前环境中设置变量 |
| `pm.environment.unset("key")` | 从当前环境中移除变量 |
| `pm.environment.clear()` | 清除所有环境变量 |
| `pm.globals.get("key")` | 获取全局变量 |
| `pm.globals.set("key", "value")` | 设置全局变量 |
| `pm.globals.unset("key")` | 移除全局变量 |
| `pm.globals.clear()` | 清除所有全局变量 |
| `pm.iterationData.get("key")` | 从当前迭代数据中获取变量 |

### 请求对象

| 方法 / 属性 | 说明 |
|-------------|------|
| `pm.request.method` | 获取 HTTP 方法 |
| `pm.request.url` | 获取请求 URL |
| `pm.request.headers.add({key, value})` | 向请求添加请求头 |
| `pm.request.headers.remove(key)` | 从请求中移除请求头 |
| `pm.request.body.raw` | 获取/设置原始请求体 |

### 响应对象

| 方法 / 属性 | 说明 |
|-------------|------|
| `pm.response.code` | HTTP 状态码（数字） |
| `pm.response.status` | HTTP 状态文本（字符串） |
| `pm.response.headers` | 响应头对象 |
| `pm.response.headers.get(name)` | 获取响应头的值 |
| `pm.response.json()` | 将响应体解析为 JSON |
| `pm.response.text()` | 获取响应体的文本内容 |
| `pm.response.responseTime` | 响应时间（毫秒） |
| `pm.response.responseSize` | 响应大小（字节） |

### 控制台日志

| 方法 | 说明 |
|------|------|
| `console.log(...)` | 输出到 ApiMate 输出通道 |
| `console.warn(...)` | 输出警告信息 |
| `console.error(...)` | 输出错误信息 |
| `console.info(...)` | 输出提示信息 |

## 测试断言

ApiMate 使用 Chai.js 进行断言，提供了丰富且富有表现力的语法。

### pm.test()

使用描述性名称定义测试用例：

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});
```

### 状态码断言

```javascript
pm.test("Status is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Status is success", function() {
    pm.expect(pm.response.code).to.be.within(200, 299);
});
```

### 响应体断言

```javascript
const response = pm.response.json();

pm.test("Response has user ID", function() {
    pm.expect(response).to.have.property("id");
});

pm.test("User name is correct", function() {
    pm.expect(response.name).to.equal("John Doe");
});

pm.test("Array has items", function() {
    pm.expect(response.items).to.be.an("array").that.is.not.empty;
});
```

### 请求头断言

```javascript
pm.test("Content-Type is JSON", function() {
    pm.response.headers.get("Content-Type").to.include("application/json");
});
```

### JSON 路径断言

```javascript
const response = pm.response.json();

pm.test("First user has email", function() {
    pm.expect(response.users[0]).to.have.property("email");
});

pm.test("Nested property exists", function() {
    pm.expect(response.data.metadata).to.have.property("created_at");
});
```

### 响应时间断言

```javascript
pm.test("Response time is under 500ms", function() {
    pm.expect(pm.response.responseTime).to.be.below(500);
});
```

### 单个测试中的多个断言

```javascript
pm.test("User object is valid", function() {
    const user = pm.response.json();
    pm.expect(user).to.have.property("id").that.is.a("number");
    pm.expect(user).to.have.property("name").that.is.a("string");
    pm.expect(user).to.have.property("email").that.matches(/^.+@.+\..+$/);
    pm.expect(user.age).to.be.above(0);
});
```

## 运行测试

### 单个请求

当发送带有后置脚本的请求时，测试结果会显示在响应查看器中：

- **通过**：绿色指示器，附带测试名称
- **失败**：红色指示器，附带测试名称和错误信息

### 集合运行器

运行集合时：

1. 每个请求的前置脚本和后置脚本都会被执行
2. 测试结果会在运行摘要中汇总
3. 显示总体通过/失败计数
4. 点击单个请求可查看详细的测试结果

### 脚本超时

脚本具有可配置的超时时间（默认：5000ms）。如果脚本超过超时时间，将被强制终止。可在 VS Code 设置中的 `apimate.scriptTimeout` 配置超时时间。
