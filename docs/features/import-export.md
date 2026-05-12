# Import & Export

ApiMate supports importing and exporting data in various formats, making it easy to migrate from other tools and share configurations.

## Import Formats

### Postman Collection (v2.1)

Import collections exported from Postman:

1. In Postman: File > Export > Collection v2.1 (recommended)
2. In ApiMate: Command Palette > ApiMate: Import Collection
3. Select the exported JSON file

**Supported elements:**
- Folders and requests hierarchy
- Request methods, URLs, headers, and body
- Pre-request and test scripts
- Authentication configurations
- Variables at collection and folder levels

### OpenAPI / Swagger (v3.0)

Import API definitions from OpenAPI/Swagger specifications:

1. Command Palette > ApiMate: Import from OpenAPI/Swagger
2. Select a JSON or YAML file

**Supported elements:**
- All HTTP methods and paths
- Request parameters (path, query, header, cookie)
- Request body schemas
- Response schemas
- Security schemes (authentication)

### cURL Command

Import a cURL command to quickly create a request:

1. Command Palette > ApiMate: Import cURL
2. Paste the cURL command
3. Toggle **Raw URL** mode for direct URL import
4. Click Import

**Supported cURL options:**

| Option | Flag | Description |
|--------|------|-------------|
| Method | `-X, --request` | HTTP method |
| Header | `-H, --header` | Request header |
| Data | `-d, --data` | Request body |
| Form | `-F, --form` | Form data |
| URL | `--url` | Request URL |
| Insecure | `-k, --insecure` | Skip SSL verification |
| Auth | `-u, --user` | Basic auth credentials |

### HAR (HTTP Archive)

Import requests from HAR files (browser network export):

1. Command Palette > ApiMate: Import from HAR
2. Select a `.har` file

**Supported elements:**
- Request method, URL, headers, and body
- Response data (for reference)
- Cookies

### .env Files

Import environment variables from `.env` files:

1. Click **Import** in the Environment section
2. Select a `.env` file
3. Variables with sensitive names are automatically marked as secret

See [Environment Variables > Import from .env](/features/environment-variables#import-from-env-files) for details.

### JSON Environment Files

Import environment configurations exported from ApiMate or compatible tools:

1. Click **Import** in the Environment section
2. Select a JSON file with the environment structure

## Export Formats

### Export Collections as JSON

Export a collection to share with team members or backup:

1. Right-click a collection > Export Collection
2. Choose save location
3. The JSON file includes all requests, folders, scripts, and configurations

**Export format:**
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

### Export Environments as JSON

Export environment configurations:

1. Right-click an environment > Export as JSON
2. Choose save location
3. Secret variable values are exported as masked placeholders

### Export Requests as cURL

Generate a cURL command for any request:

1. Right-click a request > Export as cURL
2. The cURL command is copied to clipboard

**Example output:**
```bash
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-token' \
  -d '{"Name": "John", "email": "john@example.com"}'
```

### Save Responses to Files

Save the response body directly to a file:

1. Click the **Save** button in the response viewer
2. Choose the save location and filename
3. The response body is saved with original encoding
