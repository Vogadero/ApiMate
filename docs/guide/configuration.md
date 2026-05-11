# Configuration

ApiMate can be configured through VS Code Settings. Open settings with `Ctrl+,` and search for `apimate`.

## General Settings

### `apimate.requestTimeout`

- **Type**: `number`
- **Default**: `30000`
- **Range**: 1000 - 300000
- **Description**: HTTP request timeout in milliseconds. When a request does not receive a response within the specified time, it will be automatically cancelled. Increase this value for slow APIs or large file downloads; decrease it to quickly detect unresponsive services.

### `apimate.followRedirects`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to automatically follow HTTP 3xx redirect responses. When enabled, 301/302/307/308 redirects will be followed automatically; when disabled, the redirect response is returned directly for debugging redirect chains.

### `apimate.maxRedirects`

- **Type**: `number`
- **Default**: `5`
- **Range**: 0 - 20
- **Description**: Maximum number of redirects to follow when `followRedirects` is enabled. Prevents infinite redirect loops. Once the limit is reached, the last response is returned.

### `apimate.validateSSL`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to validate SSL/TLS certificates for HTTPS requests. When enabled, self-signed or expired certificates will cause errors; when disabled, you can request local development servers using self-signed certificates, but this poses security risks.

## History Settings

### `apimate.historyLimit`

- **Type**: `number`
- **Default**: `100`
- **Range**: 10 - 1000
- **Description**: Maximum number of request history entries to keep. When the limit is exceeded, the oldest non-pinned entries are automatically removed. Pinned entries are never auto-removed.

### `apimate.autoSave`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to automatically save requests to history after sending. When enabled, every request is recorded; when disabled, you must manually save.

## Display Settings

### `apimate.prettyPrintResponses`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to automatically format JSON/XML response content. When enabled, response bodies are automatically indented for readability; when disabled, raw compact format is shown for precise inspection.

### `apimate.enableCodeLens`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to enable CodeLens hints for API route detection in code editors. When enabled, a "Send Request" action link appears above detected API routes, allowing you to send requests directly from your code.

## Storage Settings

### `apimate.storagePath`

- **Type**: `string`
- **Default**: `".vscode/apimate"`
- **Description**: Storage path for collection and environment data, relative to the workspace root. Data is saved as JSON files in this directory and can be version-controlled for team sharing. Reload data after changing this setting.

### `apimate.defaultEnvironment`

- **Type**: `string`
- **Default**: `""`
- **Description**: Environment ID to automatically activate on startup. Leave empty to not auto-activate any environment. You can copy an environment ID from the sidebar environment list context menu.

## Script & Runner Settings

### `apimate.scriptTimeout`

- **Type**: `number`
- **Default**: `5000`
- **Range**: 1000 - 30000
- **Description**: Timeout in milliseconds for pre-request and post-response scripts during collection runs. Scripts exceeding this time will be forcefully terminated to prevent infinite loops or long blocking.

### `apimate.maxParallel`

- **Type**: `number`
- **Default**: `5`
- **Range**: 1 - 100
- **Description**: Maximum number of concurrent requests during collection runs. Increase for faster runs but more server load; decrease for gentler execution. This setting syncs with the collection runner settings in the sidebar.

## Example Configuration

Add to your `.vscode/settings.json`:

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
