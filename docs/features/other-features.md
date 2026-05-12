# Other Features

Additional features that enhance your API testing workflow within VS Code.

## CodeLens Integration

ApiMate can detect API routes in your code and display a **Send Request** CodeLens action:

- Detects routes in Express, Fastify, Koa, and other frameworks
- Shows a clickable "Send Request" link above detected routes
- Click to open the request in ApiMate's editor
- Enable/disable via `apimate.enableCodeLens` setting

### Supported Frameworks

| Framework | Detection Pattern |
|-----------|-------------------|
| Express | `app.get('/path', ...)`, `router.post('/path', ...)` |
| Fastify | `fastify.get('/path', ...)` |
| Koa | `router.get('/path', ...)` |
| NestJS | `@Get('path')`, `@Post('path')` |

### Example

In your code:

```typescript
app.get('/api/users', (req, res) => {
    // Send Request  <-- CodeLens appears here
    res.json({ users: [] });
});
```

## Cookie Management

ApiMate provides a cookie manager for viewing and managing cookies:

- **View cookies**: See all cookies set by responses
- **Cookie properties**: Name, value, domain, path, expires, httpOnly, secure
- **Clear cookies**: Remove all stored cookies
- Access via Command Palette: ApiMate: Cookie Manager

## Git-Friendly Storage

All ApiMate data is stored as JSON files in your workspace:

```
.vscode/
  apimate/
    collections.json      # Collection and request data
    environments.json     # Environment configurations
    global.json           # Global variables
    history.json          # Request history
```

### Benefits

- **Version control**: Add `.vscode/apimate/` to Git for team sharing
- **Conflict resolution**: JSON files are easy to merge
- **Portability**: Copy the directory to share configurations
- **Backup**: Simple file-based backup

### .gitignore Considerations

To share collections and environments but not history:

```plaintext
.vscode/apimate/history.json
```

To keep everything private:

```plaintext
.vscode/apimate/
```

## File Watcher

ApiMate watches the storage directory for external changes:

- When JSON files are modified externally (e.g., by another team member via Git pull), ApiMate automatically reloads the data
- No manual refresh needed in most cases
- Use the **Refresh** button or Command Palette > ApiMate: Refresh Data for manual reload

## VS Code Theme Integration

ApiMate integrates with VS Code's theme system:

- **Light theme**: Optimized colors and contrast for light backgrounds
- **Dark theme**: Optimized colors and contrast for dark backgrounds
- **High Contrast**: Enhanced visibility for accessibility
- UI elements adapt to your active VS Code theme automatically

## Data Security

### Secret Variable Encryption

- Secret variables are stored using VS Code's SecretStorage API
- Values are encrypted at the OS level (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- Secret values are never stored in plain-text JSON files
- When exporting environments, secret values are replaced with placeholders

### SSL/TLS

- SSL certificate validation is enabled by default
- Disable via `apimate.validateSSL` for local development with self-signed certificates
- Supports TLS 1.2 and above
