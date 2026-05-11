# HTTP Request Editor

The HTTP Request Editor is the core of ApiMate, providing a comprehensive interface for constructing and sending HTTP requests.

## Request Methods & URL

<!-- @screenshot: request-method-url.png - Show the method selector dropdown and URL input field -->

### Supported Methods

ApiMate supports all standard HTTP methods:

| Method | Description |
|--------|-------------|
| GET | Retrieve a resource |
| POST | Create a resource |
| PUT | Replace a resource entirely |
| DELETE | Remove a resource |
| PATCH | Partially update a resource |
| HEAD | Same as GET but without response body |
| OPTIONS | Describe communication options |

### URL Input

- Enter the full request URL in the address bar
- **Environment variable auto-completion**: Type <span v-pre>`{{`</span> to trigger auto-completion of available environment and global variables
- **Special character encoding**: URLs are automatically encoded - spaces become `%20`, Chinese characters are percent-encoded, etc.
- **Query string editing**: Query parameters in the URL are automatically parsed and displayed in the parameters editor below

### Query Parameters Editor

<!-- @screenshot: query-params.png - Show the query parameters key-value editor -->

- Key-value pair editor for query parameters
- **Auto-add new row**: Start typing in the last row and a new empty row automatically appears
- Enable/disable individual parameters with checkboxes
- Parameters are synced with the URL in real-time - edit either one and the other updates

## Request Headers

<!-- @screenshot: request-headers.png - Show the headers key-value editor with quick-insert -->

### Header Editor

- Key-value pair editor for request headers
- **Auto-add new row**: Input in the last row triggers a new empty row
- Enable/disable individual headers with checkboxes

### Quick-Insert Common Headers

Click the quick-insert button to add commonly used headers:

| Header | Value |
|--------|-------|
| Content-Type | application/json |
| Content-Type | application/x-www-form-urlencoded |
| Content-Type | multipart/form-data |
| Authorization | Bearer token |
| Accept | application/json |
| Accept-Language | en-US |

### Environment Variables in Headers

::: v-pre
Use `{{variable_name}}` syntax in header values. For example:
- `Authorization: Bearer {{auth_token}}`
- `X-API-Key: {{api_key}}`
:::

Variables are resolved at send time using the active environment.

## Request Body

<!-- @screenshot: request-body.png - Show the body type selector and JSON editor -->

ApiMate supports multiple body types, selectable via tabs:

### JSON Body

- Full-featured JSON editor with syntax highlighting
- **Format button**: One-click JSON formatting and validation
- **Auto Content-Type**: Automatically sets `Content-Type: application/json`
- Supports nested objects and arrays

### Form URL-Encoded

- Key-value pair editor for `application/x-www-form-urlencoded` data
- **Auto-add new row**: Input in the last row triggers a new empty row
- Enable/disable individual fields with checkboxes
- **Auto Content-Type**: Automatically sets `Content-Type: application/x-www-form-urlencoded`

### Multipart Form-Data

- Key-value pair editor for `multipart/form-data`
- Support for **text fields** and **file uploads**
- Click the file type toggle to switch between text and file input
- File fields show a file picker dialog
- **Auto Content-Type**: Automatically sets `Content-Type: multipart/form-data` with boundary

### Raw Body

- Plain text editor for raw request bodies
- Supports multiple content types:
  - Text (text/plain)
  - XML (application/xml)
  - HTML (text/html)
- Manual Content-Type header setting required

### GraphQL Query Editor

- Dedicated GraphQL query editor with syntax highlighting
- Separate panels for **Query**, **Variables**, and **Operation Name**
- **Auto Content-Type**: Automatically sets `Content-Type: application/json`
- GraphQL introspection support for auto-completion (when endpoint supports it)

## Authentication

<!-- @screenshot: authentication.png - Show the auth type selector and auth configuration -->

ApiMate provides comprehensive authentication support. Select the auth type from the dropdown in the Auth tab.

### Basic Auth

- Enter **Username** and **Password**
- Automatically encodes credentials as Base64 in the `Authorization` header
- Header format: `Authorization: Basic base64(username:password)`

### Bearer Token

- Enter the **Token** value
- Automatically sets the `Authorization: Bearer <token>` header
::: v-pre
- Supports environment variables: `{{auth_token}}`
:::

### API Key

- Configure **Key name** and **Value**
- Choose to send via **Header** or **Query Parameter**
- Example: `X-API-Key: your-api-key` (header) or `?api_key=your-api-key` (query)

### OAuth 2.0

Supports multiple OAuth 2.0 flows:

| Flow | Use Case |
|------|----------|
| Authorization Code | Server-side web applications |
| Client Credentials | Machine-to-machine communication |
| Implicit | Single-page applications (legacy) |

Configuration options:
- **Access Token URL**: The token endpoint
- **Client ID**: Application client identifier
- **Client Secret**: Application client secret
- **Scope**: OAuth scope string
- **Authorization URL**: Required for Authorization Code flow

### AWS Signature V4

- **Access Key**: AWS access key ID
- **Secret Key**: AWS secret access key
- **Region**: AWS region (e.g., `us-east-1`)
- **Service**: AWS service name (e.g., `s3`, `execute-api`)
- Automatically generates the `Authorization` header with AWS Signature Version 4

### Digest Auth

- Enter **Username** and **Password**
- Implements HTTP Digest Authentication (RFC 7616)
- Handles the challenge-response flow automatically

### Hawk Authentication

- **Auth ID**: Hawk authentication identifier
- **Auth Key**: Hawk authentication key
- **Algorithm**: SHA-256 (default) or SHA-1
- Automatically generates the `Authorization` header per Hawk specification

### NTLM Authentication

- Enter **Username** and **Password**
- Optionally specify **Domain**
- Implements NTLM authentication protocol

## Import cURL

<!-- @screenshot: import-curl.png - Show the cURL import dialog -->

You can import a cURL command to create a request:

1. Click the **Import cURL** button in the sidebar or use the Command Palette
2. Paste your cURL command
3. Toggle **Raw URL** mode if you just want to import a URL
4. Click **Import** to create the request

Supported cURL options:
- `-X, --request` - HTTP method
- `-H, --header` - Request headers
- `-d, --data` - Request body
- `-F, --form` - Form data
- `--url` - Request URL
- `-k, --insecure` - Skip SSL verification
- `-u, --user` - Basic auth credentials
