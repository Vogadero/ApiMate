# ApiMate Webview UI

This directory contains the React-based webview UI for the ApiMate VS Code extension.

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **RemixIcon** - Icon library
- **CSS Modules** - Styling

## Development

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

This starts the Vite dev server at `http://localhost:5173` with hot module replacement.

### Build for Production

```bash
npm run build
```

This compiles TypeScript and builds the production bundle to the `dist/` directory.

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## VS Code Integration

The webview communicates with the extension host using VS Code's message passing API:

```typescript
// Get VS Code API
const vscode = window.acquireVsCodeApi();

// Send message to extension
vscode.postMessage({ type: 'sendRequest', payload: requestData });

// Receive messages from extension
window.addEventListener('message', (event) => {
  const message = event.data;
  // Handle message
});
```

## Project Structure

```
webview/
├── src/
│   ├── components/         # React components
│   │   ├── layout/         # Layout components (MainLayout)
│   │   ├── sidebar/        # Sidebar components (CollectionTree, HistoryView, EnvironmentSelector)
│   │   ├── request/        # Request editor components (RequestEditor)
│   │   └── response/       # Response viewer components (ResponseViewer)
│   ├── hooks/              # Custom React hooks
│   │   ├── useTheme.ts     # Theme detection hook
│   │   └── useVSCodeMessage.ts  # VS Code message passing hook
│   ├── types/              # TypeScript type definitions
│   │   ├── api.ts          # Core API types (HttpRequest, HttpResponse, etc.)
│   │   ├── messages.ts     # Message types for extension communication
│   │   ├── vscode.d.ts     # VS Code API type declarations
│   │   └── index.ts        # Type exports
│   ├── utils/              # Utility functions
│   │   └── vscode.ts       # VS Code API wrapper
│   ├── App.tsx             # Root component
│   ├── App.css             # App styles
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── index.html              # HTML template
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## Styling Guidelines

- Use VS Code theme variables for colors
- Apply border radius: 6-12px for modern UI
- Use RemixIcon for all icons
- Follow semantic colors for HTTP methods:
  - GET: green
  - POST: yellow
  - PUT: blue
  - DELETE: red
  - PATCH: orange
- Apply smooth transitions with appropriate easing

## Building from Root

The webview can be built from the root directory:

```bash
# From root directory
npm run build:webview
npm run watch:webview
```
