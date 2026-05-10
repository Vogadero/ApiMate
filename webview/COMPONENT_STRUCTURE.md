# ApiMate Webview Component Structure

This document describes the React component structure created for the ApiMate VS Code extension webview UI.

## Overview

The webview UI is built with React 18 and TypeScript, following a modular component architecture. The structure supports the three-column layout design specified in the requirements: activity bar, sidebar, and main content area.

## Directory Structure

```
webview/src/
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx          # Root layout component
│   │   └── MainLayout.css
│   ├── sidebar/
│   │   ├── CollectionTree.tsx      # Collections tree view
│   │   ├── CollectionTree.css
│   │   ├── HistoryView.tsx         # Request history
│   │   ├── HistoryView.css
│   │   ├── EnvironmentSelector.tsx # Environment management
│   │   └── EnvironmentSelector.css
│   ├── request/
│   │   ├── RequestEditor.tsx       # Request configuration
│   │   └── RequestEditor.css
│   ├── response/
│   │   ├── ResponseViewer.tsx      # Response display
│   │   └── ResponseViewer.css
│   └── README.md
├── hooks/
│   ├── useTheme.ts                 # VS Code theme detection
│   └── useVSCodeMessage.ts         # Message passing with extension
├── types/
│   ├── api.ts                      # Core API types
│   ├── messages.ts                 # Message types
│   ├── vscode.d.ts                 # VS Code API declarations
│   └── index.ts                    # Type exports
├── utils/
│   └── vscode.ts                   # VS Code API wrapper
├── App.tsx                         # Root component
├── App.css
├── main.tsx                        # Entry point
└── index.css                       # Global styles
```

## Component Descriptions

### Layout Components

#### MainLayout
The root layout component that implements the three-column design:
- **Activity Bar**: Vertical tab bar for switching between Collections, History, and Environment views
- **Sidebar**: Content area that displays the selected view
- **Main Content**: Split into request editor (top) and response viewer (bottom)

**Features:**
- Tab-based sidebar navigation
- Responsive layout with proper overflow handling
- State management for active tab and request/response data

### Sidebar Components

#### CollectionTree
Displays API collections in a hierarchical tree structure.

**Features:**
- Collection and folder rendering
- Empty state with "Create Collection" prompt
- Action buttons for creating new collections
- Expandable/collapsible tree structure (to be implemented)

**Props:**
- `collections`: Array of collection objects
- `onRequestSelect`: Callback when a request is selected
- `onCollectionAction`: Callback for collection actions (create, delete, etc.)

#### HistoryView
Shows request history with timestamps and status codes.

**Features:**
- Chronological list of past requests
- Method badges with semantic colors
- Status code display
- Response time and timestamp
- Clear history action

**Props:**
- `history`: Array of history entries
- `onHistorySelect`: Callback when a history item is selected
- `onClearHistory`: Callback to clear all history

#### EnvironmentSelector
Manages environment selection and displays variables.

**Features:**
- Dropdown for environment selection
- Variable list preview (first 5 variables)
- Secret variable masking
- Manage environments button

**Props:**
- `environments`: Array of environment objects
- `activeEnvironmentId`: Currently active environment ID
- `onEnvironmentChange`: Callback when environment changes
- `onManageEnvironments`: Callback to open environment management modal

### Request Components

#### RequestEditor
Main interface for configuring HTTP requests.

**Features:**
- Address bar with method selector and URL input
- Send button with loading state
- Save button for persisting requests
- Tabbed interface for:
  - Params: Query parameters
  - Auth: Authentication configuration
  - Headers: Request headers
  - Body: Request body
  - Tests: Test scripts
  - Settings: Request-specific settings

**Props:**
- `method`: HTTP method (GET, POST, etc.)
- `url`: Request URL
- `onMethodChange`: Callback when method changes
- `onUrlChange`: Callback when URL changes
- `onSend`: Callback to send the request
- `onSave`: Callback to save the request
- `isLoading`: Loading state indicator

### Response Components

#### ResponseViewer
Displays API responses with formatted content.

**Features:**
- Status badge with semantic colors
- Response time and size display
- Tabbed interface for:
  - Body: Response body with syntax highlighting
  - Cookies: Cookie information
  - Headers: Response headers
  - Tests: Test results
- Copy and save actions
- Empty state when no response

**Props:**
- `response`: HTTP response object or null

## Type Definitions

### Core API Types (`types/api.ts`)
- `HttpRequest`: Request configuration
- `HttpResponse`: Response data
- `Collection`: Collection structure
- `Folder`: Folder structure
- `Environment`: Environment configuration
- `Variable`: Variable definition
- `AuthConfig`: Authentication configuration
- Various auth type interfaces

### Message Types (`types/messages.ts`)
- `WebviewMessage`: Base message interface
- Specific message types for extension communication:
  - `SendRequestMessage`
  - `SaveRequestMessage`
  - `CreateCollectionMessage`
  - `RequestCompleteMessage`
  - `DataLoadedMessage`

## Custom Hooks

### useTheme
Detects and responds to VS Code theme changes (light, dark, high-contrast).

**Returns:** Current theme as a string

### useVSCodeMessage
Manages message passing between webview and extension host.

**Parameters:**
- `onMessage`: Callback function to handle incoming messages

**Returns:**
- `sendMessage`: Function to send messages to extension

## Styling Guidelines

### CSS Variables
The project uses CSS custom properties for consistent styling:

**Spacing:**
- `--spacing-xs` through `--spacing-xl`

**Border Radius:**
- `--radius-sm` through `--radius-xl` (4px to 12px)

**Transitions:**
- `--transition-fast`: 0.15s ease
- `--transition-normal`: 0.25s ease

**HTTP Method Colors:**
- `--method-get`: Blue (#61affe)
- `--method-post`: Green (#49cc90)
- `--method-put`: Orange (#fca130)
- `--method-delete`: Red (#f93e3e)
- `--method-patch`: Teal (#50e3c2)

**Status Colors:**
- `--status-success`: Green (2xx)
- `--status-redirect`: Blue (3xx)
- `--status-client-error`: Orange (4xx)
- `--status-server-error`: Red (5xx)

### VS Code Theme Integration
All components use VS Code theme variables for colors:
- `--vscode-foreground`
- `--vscode-background`
- `--vscode-editor-background`
- `--vscode-sideBar-background`
- `--vscode-button-background`
- And many more...

### Icon System
RemixIcon is used for all icons throughout the UI. Icons are referenced using the `ri-*` class names.

## Build Configuration

### TypeScript
- Strict mode enabled
- React JSX transform
- Path aliases configured

### Vite
- Fast development server with HMR
- Optimized production builds
- CSS bundling and minification

## Future Enhancements

Components to be implemented in future tasks:

1. **KeyValueTable**: Reusable table editor for params, headers, variables
2. **BodyEditor**: Advanced body editor with Monaco integration
3. **AuthConfig**: Detailed authentication configuration forms
4. **EnvironmentModal**: Full environment management modal
5. **ImportExportModal**: Import/export functionality
6. **ContextMenu**: Right-click context menus
7. **TestResults**: Detailed test results panel
8. **CookieViewer**: Cookie management interface
9. **MonacoEditor**: Code editor integration for scripts and bodies

## Communication Flow

```
User Interaction
    ↓
React Component
    ↓
useVSCodeMessage hook
    ↓
vscode.postMessage()
    ↓
Extension Host
    ↓
Process Request
    ↓
window.postMessage()
    ↓
useVSCodeMessage hook
    ↓
React Component Update
    ↓
UI Update
```

## Testing

The component structure is designed to be testable:
- Components are pure and receive data via props
- Business logic is separated from UI
- Custom hooks can be tested independently
- Mock VS Code API for testing

## Accessibility

Future accessibility improvements:
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus management
- Screen reader support
- High contrast theme support

## Performance Considerations

- Virtual scrolling for large collections (to be implemented)
- Memoization of expensive computations
- Lazy loading of heavy components
- Efficient re-rendering with React.memo
- Debounced input handlers

## Conclusion

This component structure provides a solid foundation for the ApiMate webview UI. It follows React best practices, integrates seamlessly with VS Code theming, and is designed for extensibility and maintainability.
