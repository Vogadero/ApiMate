# Changelog

## v0.0.4

Initial release of ApiMate.

### Features

- **HTTP Request Editor**: Support all HTTP methods, URL with environment variable auto-completion, query parameters editor, multiple body types (JSON, form-urlencoded, multipart form-data, raw, GraphQL), and comprehensive authentication (Basic Auth, Bearer Token, API Key, OAuth 2.0, AWS Signature V4, Digest Auth, Hawk, NTLM).
- **Response Viewer**: Syntax highlighted response body, headers viewer, status code with color indicator, response time and size display, cookie viewer, copy/save/export actions.
- **Collections**: Create, rename, delete collections with multi-level folder nesting, drag-and-drop reordering, copy folders and requests, save requests to collections, export as JSON.
- **Collection Runner**: Run entire collections sequentially or in parallel, iteration data support (CSV/JSON), configurable max parallel requests, pre-request and post-response scripts, test results with pass/fail indicators.
- **Environment Variables**: Multiple named environments, global variables, secret variable type with VS Code SecretStorage encryption, variable resolution preview, inherited global variables with override indicators, import from .env files, import/export as JSON, one-click activation.
- **Variable Resolution**: <span v-pre>`{{variable_name}}`</span> syntax in URL, headers, body, and query params; resolution priority (Local > Iteration Data > Environment > Collection > Global); recursive resolution up to 10 levels; dynamic variables (`$timestamp`, `$randomInt`, `$guid`, `$randomString`, `$faker.*`).
- **Import & Export**: Import from Postman Collection (v2.1), OpenAPI/Swagger (v3.0), cURL, HAR, and .env files; export collections, environments, and requests.
- **Scripts & Testing**: Pre-request and post-response scripts with `pm` API, Chai.js assertions, structured test cases.
- **Multi-Protocol**: HTTP/HTTPS, gRPC (unary, server streaming, client streaming, bidirectional), WebSocket, Server-Sent Events (SSE).
- **History**: Auto-save request history, pin important requests, search and filter, re-send from history.
- **VS Code Integration**: CodeLens for API route detection, keyboard shortcuts, theme integration, Git-friendly JSON storage, file watcher for auto-reload.
