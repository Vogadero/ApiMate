# Getting Started

## Installation

1. Open VS Code
2. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **ApiMate**
4. Click **Install**

Or install via the CLI:

```bash
code --install-install apimate-0.0.4.vsix
```

## First Steps

After installing ApiMate, you'll see the ApiMate icon in the Activity Bar on the left side of VS Code. Click it to open the sidebar panel.

### Creating Your First Request

1. Click the **+** button in the sidebar or use the keyboard shortcut `Ctrl+Alt+N`
2. Select the HTTP method (GET, POST, PUT, DELETE, etc.)
3. Enter the request URL
4. Add headers, query parameters, or body as needed
5. Click **Send** or use `Ctrl+Alt+S`

### Organizing with Collections

1. Click the **New Collection** button in the sidebar
2. Give your collection a name
3. Drag requests into the collection
4. Create folders within collections for further organization
5. Use the **Save to Collection** button in the request editor

### Setting Up Environments

1. Click the **Environment** tab in the sidebar
2. Click **New Environment** and name it (e.g., "Development", "Production")
3. Add variables as key-value pairs (e.g., `base_url` = `http://localhost:3000`)
4. Use <span v-pre>`{{variable_name}}`</span> syntax in requests
5. Switch between environments with one click or `Ctrl+Alt+E`

## Quick Reference

| Action | How |
|--------|-----|
| New Request | `Ctrl+Alt+N` or click + in sidebar |
| Send Request | `Ctrl+Alt+S` or click Send button |
| Switch Environment | `Ctrl+Alt+E` or click environment selector |
| Import cURL | Command Palette > ApiMate: Import cURL |
| Import Collection | Command Palette > ApiMate: Import Collection |
| View History | Click History tab in sidebar |

## Data Storage

ApiMate stores all your data as JSON files in the `.vscode/apimate/` directory within your workspace. This means:

- Your data is **workspace-specific** - each project has its own collections and environments
- Data can be **version-controlled** - add `.vscode/apimate/` to your Git repository for team sharing
- Data is **portable** - copy the directory to share configurations between machines

You can customize the storage path in VS Code Settings under `apimate.storagePath`.
