/**
 * VS Code Webview API type definitions
 */

export interface VSCodeAPI {
  /**
   * Post a message to the extension host
   */
  postMessage(message: any): void;

  /**
   * Get the persistent state for this webview
   */
  getState(): any;

  /**
   * Set the persistent state for this webview
   */
  setState(state: any): void;
}

/**
 * Message types sent from webview to extension
 */
export type WebviewToExtensionMessage =
  | { type: 'sendRequest'; payload: any }
  | { type: 'saveRequest'; payload: any }
  | { type: 'deleteRequest'; payload: { requestId: string } }
  | { type: 'createCollection'; payload: { name: string } }
  | { type: 'importCollection'; payload: any }
  | { type: 'exportCollection'; payload: { collectionId: string } }
  | { type: 'switchEnvironment'; payload: { environmentId: string } }
  | { type: 'updateVariable'; payload: any }
  | { type: 'runCollection'; payload: { collectionId: string } };

/**
 * Message types sent from extension to webview
 */
export type ExtensionToWebviewMessage =
  | { type: 'updateCollections'; payload: any[] }
  | { type: 'updateRequest'; payload: any }
  | { type: 'updateResponse'; payload: any }
  | { type: 'updateEnvironments'; payload: any[] }
  | { type: 'updateTestResults'; payload: any[] }
  | { type: 'error'; payload: { message: string } };

declare global {
  interface Window {
    /**
     * Acquire the VS Code API for webview communication
     */
    acquireVsCodeApi(): VSCodeAPI;
  }
}
