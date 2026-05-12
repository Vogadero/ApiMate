# Collections

Collections allow you to organize, save, and run groups of related API requests.

## Collection Management

![Collection tree with folders and requests](/collections.png)

### Creating Collections

1. Click **New Collection** in the sidebar
2. Enter a name for the collection
3. Start adding requests and folders

### Organizing with Folders

- **Multi-level nesting**: Create folders within folders for deep organization
  - Collection > Folder > Sub-folder > Request
- **Create folders**: Right-click a collection or folder > New Folder
- **Rename folders**: Right-click a folder > Rename
- **Delete folders**: Right-click a folder > Delete (removes all contents)
- **Copy folders**: Right-click a folder > Copy (creates a duplicate at the same level)

### Managing Requests in Collections

- **Save to Collection**: Click the Save button in the request editor to save the current request to a collection
- **Drag-and-drop**: Reorder requests and folders by dragging
- **Copy requests**: Right-click a request > Duplicate
- **Rename requests**: Right-click a request > Rename
- **Delete requests**: Right-click a request > Delete

### Collection Tree Structure

The sidebar displays collections in a hierarchical tree:

```
Collection Name
  Folder
    Request 1
    Request 2
    Sub-folder
      Request 3
  Request 4
```

- **Visual hierarchy**: Different indentation levels with connecting lines
- **Background colors**: Alternating colors for different nesting levels
- **Context menus**: Right-click any item for available actions
- **Hover actions**: Quick action buttons appear on hover

### Export Collections

- Right-click a collection > Export Collection
- Exports as JSON file
- Includes all requests, folders, and their configurations
- Can be imported by other ApiMate users

## Collection Runner

The Collection Runner allows you to execute all requests in a collection automatically.

### Running a Collection

1. Right-click a collection > Run Collection
2. Configure run settings:
   - **Run mode**: Sequential or Parallel
   - **Max parallel requests**: Control concurrency (default: 5)
   - **Iterations**: Number of times to run the collection
   - **Iteration data**: CSV or JSON file for data-driven testing
3. Click **Start Run**

### Iteration Data

Use data files for data-driven testing:

**CSV format:**
```csv
username,password,expected_status
admin,admin123,200
user,user123,200
guest,guest123,401
```

**JSON format:**
```json
[
  { "username": "admin", "password": "admin123", "expected_status": 200 },
  { "username": "user", "password": "user123", "expected_status": 200 },
  { "username": "guest", "password": "guest123", "expected_status": 401 }
]
```

Access iteration data in scripts via `pm.iterationData.get("key")`.

### Run Results

- Each request shows its result: **Pass** (green) or **Fail** (red)
- Response status code and time displayed per request
- Test assertion results shown for each request
- Overall summary: total requests, passed, failed, total time

### Pre-request and Post-response Scripts

Each request in a collection can have scripts that run before and after the request:

- **Pre-request Script**: Modify the request before sending (set variables, modify headers, etc.)
- **Post-response Script**: Process the response after receiving (extract data, run assertions, etc.)

See [Scripts & Testing](/features/scripts-testing) for detailed scripting documentation.
