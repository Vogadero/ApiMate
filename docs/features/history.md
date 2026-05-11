# History

ApiMate automatically saves your request history for quick access and re-execution.

## Request History

<!-- @screenshot: history-view.png - Show the history tab in the sidebar -->

### Auto-Save

- Every request you send is automatically saved to history (when `apimate.autoSave` is enabled)
- History entries include: method, URL, status code, response time, and timestamp
- The history limit is configurable via `apimate.historyLimit` (default: 100)

### Pinning Important Requests

- **Pin** important requests to keep them at the top of the history list
- Pinned requests are never auto-removed when the history limit is reached
- Click the pin icon to pin/unpin a request

### Search and Filter

<!-- @screenshot: history-search.png - Show the search/filter functionality -->

- **Search**: Filter history by URL, method, or status code
- **Method filter**: Show only specific HTTP methods (GET, POST, etc.)
- **Status filter**: Show only specific status code ranges (2xx, 4xx, 5xx)

### Re-send from History

- Click any history entry to open the request in the editor
- The request is fully restored with all headers, body, and authentication
- Click **Send** to re-execute the request

### Clear History

- Use the Command Palette: ApiMate: Clear History
- Or click the **Clear** button in the History tab
- This removes all history entries (including pinned ones)

### History Entry Details

Each history entry shows:

| Field | Description |
|-------|-------------|
| Method | HTTP method with color indicator |
| URL | Request URL (truncated if too long) |
| Status | Response status code with color |
| Time | Response time in milliseconds |
| Date | When the request was sent |
| Pin | Pin status indicator |
