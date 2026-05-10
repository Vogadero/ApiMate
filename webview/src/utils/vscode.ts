// VS Code API utilities

interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

class VSCodeAPIWrapper {
  private readonly api: VSCodeAPI;

  constructor() {
    this.api = (window as any).acquireVsCodeApi();
  }

  /**
   * Send a message to the extension host
   */
  public postMessage(message: any): void {
    this.api.postMessage(message);
  }

  /**
   * Get the persistent state for this webview
   */
  public getState<T = any>(): T | undefined {
    return this.api.getState();
  }

  /**
   * Set the persistent state for this webview
   */
  public setState<T = any>(state: T): void {
    this.api.setState(state);
  }
}

// Singleton instance
export const vscode = new VSCodeAPIWrapper();
