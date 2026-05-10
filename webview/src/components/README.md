# ApiMate Webview Components

This directory contains all React components for the ApiMate webview UI.

## Directory Structure

```
components/
├── layout/              # Layout components
│   └── MainLayout       # Main three-column layout
├── sidebar/             # Sidebar components
│   ├── CollectionTree   # Collections tree view
│   ├── HistoryView      # Request history view
│   └── EnvironmentSelector  # Environment selector
├── request/             # Request editor components
│   └── RequestEditor    # Main request editor
├── response/            # Response viewer components
│   └── ResponseViewer   # Response display
└── README.md           # This file
```

## Component Organization

### Layout Components
- **MainLayout**: The root layout component that orchestrates the three-column layout (activity bar, sidebar, main content)

### Sidebar Components
- **CollectionTree**: Displays collections, folders, and requests in a tree structure
- **HistoryView**: Shows request history with timestamps and status
- **EnvironmentSelector**: Allows switching between environments and viewing variables

### Request Components
- **RequestEditor**: Main request configuration interface with tabs for params, auth, headers, body, tests, and settings

### Response Components
- **ResponseViewer**: Displays API responses with tabs for body, cookies, headers, and test results

## Component Guidelines

### Styling
- Each component has its own CSS file co-located with the component
- Use VS Code theme variables for colors
- Apply border radius: 6-12px for modern UI
- Use RemixIcon for all icons
- Follow semantic colors for HTTP methods:
  - GET: `var(--method-get)` (blue)
  - POST: `var(--method-post)` (green)
  - PUT: `var(--method-put)` (orange)
  - DELETE: `var(--method-delete)` (red)
  - PATCH: `var(--method-patch)` (teal)

### Props
- Use TypeScript interfaces for all props
- Keep components focused and single-purpose
- Pass callbacks for user interactions

### State Management
- Local state for UI-only concerns
- Props for data from parent components
- VS Code message passing for extension communication

## Adding New Components

When adding new components:

1. Create a new directory for the component category if needed
2. Create both `.tsx` and `.css` files
3. Export the component from the file
4. Import and use in parent components
5. Update this README with the new component

## Future Components

Components to be implemented in future tasks:

- **KeyValueTable**: Reusable table editor for params, headers, etc.
- **BodyEditor**: Advanced body editor with Monaco integration
- **AuthConfig**: Authentication configuration forms
- **EnvironmentModal**: Modal for managing environments
- **ImportExportModal**: Modal for import/export operations
- **ContextMenu**: Right-click context menus
- **TestResults**: Test results display panel
- **CookieViewer**: Cookie management interface
