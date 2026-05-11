# Response Viewer

After sending a request, the Response Viewer displays the complete server response with rich visualization.

## Response Display

<!-- @screenshot: response-viewer.png - Show the full response viewer with body, headers, and status -->

### Response Body

The response body is displayed with syntax highlighting based on the Content-Type:

| Content Type | Highlighting |
|-------------|-------------|
| application/json | JSON syntax highlighting with collapsible nodes |
| application/xml | XML syntax highlighting |
| text/html | HTML syntax highlighting |
| text/css | CSS syntax highlighting |
| Other | Plain text display |

#### Pretty Print / Raw Toggle

- **Pretty**: Formatted and indented response with syntax highlighting
- **Raw**: Original unformatted response text
- Toggle between modes with the Pretty/Raw button

### Response Headers

<!-- @screenshot: response-headers.png - Show the response headers viewer -->

- All response headers displayed as key-value pairs
- Common headers highlighted for quick identification
- Click to copy individual header values

### Status Code

<!-- @screenshot: status-code.png - Show the status code indicator with color -->

The HTTP status code is displayed with a color indicator:

| Color | Status Range | Meaning |
|-------|-------------|---------|
| Green | 2xx | Success |
| Yellow | 3xx | Redirection |
| Orange | 4xx | Client Error |
| Red | 5xx | Server Error |

### Response Time

- Displayed in milliseconds (ms)
- Color-coded: green for fast, yellow for moderate, red for slow responses
- Helps identify performance bottlenecks

### Response Size

- Displayed in human-readable format (B, KB, MB)
- Includes both headers and body size
- Useful for monitoring payload sizes

### Cookie Viewer

<!-- @screenshot: cookie-viewer.png - Show the cookie viewer -->

- View all cookies set by the response (`Set-Cookie` headers)
- Display cookie properties: name, value, domain, path, expires, httpOnly, secure
- Access via the Cookie Manager command or sidebar

## Response Actions

### Copy Response Body

- One-click copy of the entire response body to clipboard
- Preserves formatting in Pretty mode

### Save Response to File

- Save the response body to a local file
- File dialog for choosing save location
- Preserves the original encoding

### Export as cURL Command

- Generate a cURL command that reproduces the request
- Includes method, URL, headers, and body
- Copy to clipboard for use in terminal

### Pretty Print / Raw Toggle

- Switch between formatted and raw response display
- Applies to JSON and XML content types
