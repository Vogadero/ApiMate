# Environment Variables

Environment variables are a core feature that allows you to define and switch between different runtime contexts (e.g., Development, Staging, Production) without modifying individual requests.

## Environment Management

<!-- @screenshot: environment-manager.png - Show the environment management interface -->

### Creating Environments

1. Click the **Environment** tab in the sidebar
2. Click **New Environment**
3. Name your environment (e.g., "Development", "Staging", "Production")
4. Add variables as key-value pairs

### Environment Operations

| Action | How |
|--------|-----|
| Create | Click "New Environment" |
| Rename | Right-click > Rename |
| Duplicate | Right-click > Duplicate |
| Delete | Right-click > Delete |
| Activate | Click the environment name or use `Ctrl+Alt+E` |
| Export | Right-click > Export as JSON |
| Import | Click "Import" and select a JSON or .env file |

### Activating an Environment

- Click the environment name in the sidebar to activate it
- Use `Ctrl+Alt+E` to open the environment switcher
- The active environment is highlighted and shown in the environment selector
- Only one environment can be active at a time

## Global Variables

<!-- @screenshot: global-variables.png - Show the global variables editor -->

Global variables are shared across all environments:

- Defined in the **Global Variables** section at the top of the Environment tab
- Available in every request regardless of the active environment
- **Visual distinction**: Gold color for global variables, blue for environment variables
- When an environment variable has the same name as a global variable, the environment variable takes precedence

### Global vs Environment Variables

| Property | Global Variables | Environment Variables |
|----------|-----------------|----------------------|
| Scope | All environments | Specific environment |
| Color indicator | Gold | Blue |
| Override | Overridden by env vars | Overrides global |
| Storage | `.vscode/apimate/global.json` | `.vscode/apimate/environments.json` |

## Secret Variables

<!-- @screenshot: secret-variables.png - Show the secret variable toggle and masked display -->

Secret variables provide secure storage for sensitive data like API keys and tokens:

- **Masked display**: Values are shown as `****` in the UI
- **VS Code SecretStorage encryption**: Values are encrypted using VS Code's built-in secure storage mechanism
- **Quick toggle**: Switch between secret and default variable type with one click
- **Auto-detection**: When importing .env files, variables with sensitive names (containing `key`, `secret`, `password`, `token`, `auth`) are automatically marked as secret

### Using Secret Variables

1. Add a variable and click the **lock icon** to mark it as secret
2. The value will be masked in the UI
3. The actual value is stored in VS Code SecretStorage, not in the JSON file
4. When sending a request, the real value is retrieved from SecretStorage

## Variable Resolution

<!-- @screenshot: variable-resolution.png - Show the variable resolution preview -->

### Using Variables in Requests

::: v-pre
Use the `{{variable_name}}` syntax in any request field:

- **URL**: `https://{{base_url}}/api/users`
- **Headers**: `Authorization: Bearer {{auth_token}}`
- **Body**: `{"username": "{{username}}"}`
- **Query Parameters**: `?api_key={{api_key}}`
:::

### Resolution Priority

Variables are resolved in the following priority order (highest to lowest):

1. **Local** - Variables defined in the current request's scripts
2. **Iteration Data** - Variables from the collection runner's data file
3. **Environment** - Variables in the active environment
4. **Collection** - Variables defined at the collection level
5. **Global** - Global variables shared across all environments

When variables with the same name exist at multiple levels, the highest-priority value is used.

### Recursive Resolution

Variables can reference other variables, and ApiMate will resolve them recursively:

```
base_url = https://api.example.com
api_path = {{base_url}}/v2
endpoint = {{api_path}}/users
```

Result: `https://api.example.com/v2/users`

- Maximum recursion depth: **10 levels**
- Circular references are detected and prevented

### Dynamic Variables

ApiMate provides built-in dynamic variables that generate values at request time:

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `$timestamp` | Current Unix timestamp | `1699999999` |
| `$randomInt` | Random integer (0-1000) | `427` |
| `$guid` | Random UUID v4 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `$randomString` | Random alphanumeric string (8 chars) | `k9Xm2pLq` |
| `$faker.firstName` | Random first name | `John` |
| `$faker.lastName` | Random last name | `Smith` |
| `$faker.email` | Random email address | `john.smith@example.com` |
| `$faker.phoneNumber` | Random phone number | `555-123-4567` |
| `$faker.address` | Random street address | `123 Main St` |
| `$faker.city` | Random city name | `Springfield` |
| `$faker.country` | Random country name | `United States` |
| `$faker.companyName` | Random company name | `Acme Corp` |
| `$faker.url` | Random URL | `https://example.com/page` |
| `$faker.ip` | Random IPv4 address | `192.168.1.1` |

### Variable Resolution Preview

<!-- @screenshot: variable-preview.png - Show the variable resolution preview section -->

The environment detail view includes a **Variable Resolution Preview** section that shows:

- Merged view of all active variables (global + environment)
- Which variables are inherited from global scope
- Which environment variables override global variables
::: v-pre
- Example URL resolution showing how `{{variable_name}}` is replaced
:::

### Unresolved Variables

If a variable name cannot be resolved from any source, it remains as-is in the request:

::: v-pre
- `https://api.example.com/{{unknown_var}}` is sent as `https://api.example.com/{{unknown_var}}`
:::

- This helps you identify missing variable definitions

## Import from .env Files

<!-- @screenshot: import-env.png - Show the .env import dialog -->

Import environment variables from `.env` files:

1. Click **Import** in the environment section
2. Select a `.env` file
3. ApiMate auto-parses the file and creates variables
4. Sensitive variable names (containing `key`, `secret`, `password`, `token`, `auth`) are automatically marked as secret

Example `.env` file:
```env
BASE_URL=https://api.example.com
API_KEY=sk-abc123def456
DB_PASSWORD=mysecretpassword
DEBUG=true
```

After import:
- `BASE_URL` - default variable
- `API_KEY` - secret variable (auto-detected)
- `DB_PASSWORD` - secret variable (auto-detected)
- `DEBUG` - default variable
