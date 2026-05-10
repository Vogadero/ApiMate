import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Plugin that transforms the built index.html for VS Code webview compatibility:
 * - Replaces absolute asset paths with relative paths (required for vscode-webview-resource: URIs)
 * - Converts module scripts to regular scripts (VS Code webview CSP compatibility)
 * - Preserves {{cspSource}} and {{nonce}} placeholders for runtime injection by the extension host
 */
function vscodeWebviewPlugin(): Plugin {
  return {
    name: 'vscode-webview',
    apply: 'build',
    closeBundle() {
      const htmlPath = resolve(__dirname, 'dist', 'index.html');
      let html = readFileSync(htmlPath, 'utf-8');

      // Convert absolute asset paths to relative paths.
      // VS Code webview resources are served via vscode-webview-resource: URIs,
      // so all src/href attributes must use relative paths.
      html = html.replace(/(src|href)="\//g, '$1="./');

      // Convert <script type="module"> to plain <script> for CSP compatibility.
      // VS Code webview CSP requires 'unsafe-inline' or nonces; module scripts
      // behave differently and can cause issues with some CSP configurations.
      html = html.replace(/<script type="module"/g, '<script');

      writeFileSync(htmlPath, html, 'utf-8');
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vscodeWebviewPlugin()],

  build: {
    outDir: 'dist',
    // Target ES2020 for VS Code webview (Chromium-based, supports modern JS)
    target: 'es2020',
    // Use esbuild minification for faster builds
    minify: 'esbuild',
    // Generate source maps for debugging within VS Code DevTools
    sourcemap: true,
    // Keep CSS in a single file — VS Code webview loads assets individually
    // and splitting CSS can cause FOUC or missing styles
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Use deterministic, non-hashed filenames so the extension host can
        // reference them by a known path when constructing webview URIs
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        // Output as IIFE (immediately-invoked function expression) rather than
        // ES modules. VS Code webview CSP with 'unsafe-inline' works reliably
        // with IIFE bundles; ES module dynamic imports can be blocked by CSP.
        format: 'iife',
        // Single bundle — disable code splitting to avoid dynamic import()
        // calls which are blocked by VS Code webview CSP in many configurations
        inlineDynamicImports: true,
      },
    },
    // Warn when a chunk exceeds 1MB (webviews load everything upfront)
    chunkSizeWarningLimit: 1024,
  },

  // Inject NODE_ENV so React uses the production build (no dev warnings)
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Dev server config — used when running `vite` for local development outside VS Code
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
    },
  },
});
