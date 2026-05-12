# Scripts & Testing

ApiMate provides a powerful scripting engine for automating request workflows and validating responses.

## Pre-request Scripts

Pre-request scripts run **before** a request is sent. Use them to:

- Set or modify variables
- Add dynamic headers
- Modify the request body
- Generate timestamps or signatures
- Implement custom authentication logic

### Accessing Pre-request Script Editor

1. Open a request in the editor
2. Click the **Scripts** tab
3. Select **Pre-request Script**

### Example: Set Timestamp Header

```javascript
pm.environment.set("timestamp", new Date().toISOString());
pm.request.headers.add({
    key: "X-Timestamp",
    value: pm.environment.get("timestamp")
});
```

### Example: HMAC Signature

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

## Post-response Scripts

Post-response scripts run **after** a response is received. Use them to:

- Extract data from responses and save to variables
- Validate response data with assertions
- Log response details
- Chain requests by setting variables for subsequent requests

### Accessing Post-response Script Editor

1. Open a request in the editor
2. Click the **Scripts** tab
3. Select **Post-response Script**

### Example: Extract Token from Login Response

```javascript
const response = pm.response.json();
pm.environment.set("auth_token", response.token);
pm.environment.set("user_id", response.user.id);
```

### Example: Validate Response Structure

```javascript
const response = pm.response.json();
pm.test("Response has required fields", function() {
    pm.expect(response).to.have.property("id");
    pm.expect(response).to.have.property("name");
    pm.expect(response).to.have.property("email");
});
```

## pm API Reference

The `pm` object provides access to request, response, and environment data.

### Environment & Global Variables

| Method | Description |
|--------|-------------|
| `pm.environment.get("key")` | Get a variable from the active environment |
| `pm.environment.set("key", "value")` | Set a variable in the active environment |
| `pm.environment.unset("key")` | Remove a variable from the active environment |
| `pm.environment.clear()` | Clear all environment variables |
| `pm.globals.get("key")` | Get a global variable |
| `pm.globals.set("key", "value")` | Set a global variable |
| `pm.globals.unset("key")` | Remove a global variable |
| `pm.globals.clear()` | Clear all global variables |
| `pm.iterationData.get("key")` | Get a variable from the current iteration data |

### Request Object

| Method / Property | Description |
|-------------------|-------------|
| `pm.request.method` | Get the HTTP method |
| `pm.request.url` | Get the request URL |
| `pm.request.headers.add({key, value})` | Add a header to the request |
| `pm.request.headers.remove(key)` | Remove a header from the request |
| `pm.request.body.raw` | Get/set the raw request body |

### Response Object

| Method / Property | Description |
|-------------------|-------------|
| `pm.response.code` | HTTP status code (number) |
| `pm.response.status` | HTTP status text (string) |
| `pm.response.headers` | Response headers object |
| `pm.response.headers.get(name)` | Get a response header value |
| `pm.response.json()` | Parse response body as JSON |
| `pm.response.text()` | Get response body as text |
| `pm.response.responseTime` | Response time in ms |
| `pm.response.responseSize` | Response size in bytes |

### Console Logging

| Method | Description |
|--------|-------------|
| `console.log(...)` | Log to the ApiMate output channel |
| `console.warn(...)` | Log a warning |
| `console.error(...)` | Log an error |
| `console.info(...)` | Log an info message |

## Test Assertions

ApiMate uses Chai.js for assertions, providing a rich and expressive syntax.

### pm.test()

Define test cases with descriptive names:

```javascript
pm.test("Status code is 200", function() {
    pm.response.to.have.status(200);
});
```

### Status Code Assertions

```javascript
pm.test("Status is 200", function() {
    pm.response.to.have.status(200);
});

pm.test("Status is success", function() {
    pm.expect(pm.response.code).to.be.within(200, 299);
});
```

### Response Body Assertions

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

### Header Assertions

```javascript
pm.test("Content-Type is JSON", function() {
    pm.response.headers.get("Content-Type").to.include("application/json");
});
```

### JSON Path Assertions

```javascript
const response = pm.response.json();

pm.test("First user has email", function() {
    pm.expect(response.users[0]).to.have.property("email");
});

pm.test("Nested property exists", function() {
    pm.expect(response.data.metadata).to.have.property("created_at");
});
```

### Response Time Assertions

```javascript
pm.test("Response time is under 500ms", function() {
    pm.expect(pm.response.responseTime).to.be.below(500);
});
```

### Multiple Assertions in One Test

```javascript
pm.test("User object is valid", function() {
    const user = pm.response.json();
    pm.expect(user).to.have.property("id").that.is.a("number");
    pm.expect(user).to.have.property("name").that.is.a("string");
    pm.expect(user).to.have.property("email").that.matches(/^.+@.+\..+$/);
    pm.expect(user.age).to.be.above(0);
});
```

## Running Tests

### Individual Request

When you send a request with post-response scripts, the test results are displayed in the response viewer:

- **Pass**: Green indicator with test name
- **Fail**: Red indicator with test name and error message

### Collection Runner

When running a collection:

1. Each request's pre-request and post-response scripts are executed
2. Test results are aggregated in the run summary
3. Overall pass/fail count is displayed
4. Click individual requests to see detailed test results

### Script Timeout

Scripts have a configurable timeout (default: 5000ms). If a script exceeds the timeout, it is forcefully terminated. Configure the timeout in VS Code Settings under `apimate.scriptTimeout`.
