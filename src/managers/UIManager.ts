import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export type MessageType =
  | 'sendRequest'
  | 'saveRequest'
  | 'deleteRequest'
  | 'createCollection'
  | 'deleteCollection'
  | 'importCollection'
  | 'exportCollection'
  | 'switchEnvironment'
  | 'updateVariable'
  | 'runCollection'
  | 'clearHistory'
  | 'loadData'
  | 'requestComplete'
  | 'dataLoaded'
  | 'collectionRunResult'
  | 'newRequest'
  | 'triggerSendRequest'
  | 'importCurl'
  | 'openEditor'
  | 'openInEditor'
  | 'viewCookies'
  | 'viewLogs'
  | 'clearCache'
  | 'showShortcuts'
  | 'openSettings'
  | 'renameHistoryEntry'
  | 'deleteHistoryEntry'
  | 'copyHistoryEntry'
  | 'pinHistoryEntry'
  | 'createEnvironment'
  | 'importEnvironment'
  | 'deleteEnvironment'
  | 'addEnvironmentVariable'
  | 'deleteEnvironmentVariable'
  | 'duplicateEnvironment'
  | 'renameEnvironment'
  | 'updateGlobalVariable'
  | 'deleteGlobalVariable'
  | 'importEnvFile'
  | 'renameCollection'
  | 'duplicateCollection'
  | 'addFolder'
  | 'addRequestToCollection'
  | 'duplicateRequest'
  | 'renameRequest'
  | 'pinRequest'
  | 'renameFolder'
  | 'deleteFolder'
  | 'showImportDialog'
  | 'showCurlImport'
  | 'clearCookies'
  | 'deleteCookie'
  | 'selectFile'
  | 'fileSelected';

export interface WebviewMessage {
  type: MessageType;
  payload?: any;
}

export type MessageHandler = (message: WebviewMessage) => void | Promise<void>;

class ApiMateWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'apimate.sidebar';
  private _view?: vscode.WebviewView;
  private webviewDistPath: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly uiManager: UIManager,
  ) {
    this.webviewDistPath = path.join(context.extensionPath, 'webview', 'dist');
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.title = '';

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this.webviewDistPath)],
    };

    webviewView.webview.html = this.uiManager.getHtmlForWebview(webviewView.webview, this.webviewDistPath);

    this.uiManager.attachMessageListenerToWebview(webviewView.webview);

    webviewView.onDidDispose(() => {
      this._view = undefined;
    });
  }

  get view(): vscode.WebviewView | undefined {
    return this._view;
  }
}

export class UIManager {
  private panels: vscode.WebviewPanel[] = [];
  private sidebarProvider: ApiMateWebviewViewProvider | null = null;
  private messageHandlers: Map<MessageType, MessageHandler[]> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  registerSidebarProvider(): void {
    this.sidebarProvider = new ApiMateWebviewViewProvider(this.context, this);
    this.context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        ApiMateWebviewViewProvider.viewType,
        this.sidebarProvider,
      ),
    );
  }

  createWebviewPanel(requestData?: Record<string, unknown>): void {
    const webviewDistPath = path.join(this.context.extensionPath, 'webview', 'dist');
    const iconPath = vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'icon.svg'));

    const requestName = (requestData?.request as any)?.name || (requestData?.request as any)?.url || 'ApiMate';
    const shortName = String(requestName).length > 30 ? String(requestName).substring(0, 30) + '...' : String(requestName);

    const panel = vscode.window.createWebviewPanel(
      'apimate-editor',
      shortName,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(webviewDistPath),
          vscode.Uri.file(path.join(this.context.extensionPath, 'resources')),
        ],
      },
    );

    panel.iconPath = iconPath;

    panel.webview.html = this.getHtmlForWebview(panel.webview, webviewDistPath, 'editor', requestData);

    this.attachMessageListenerToWebview(panel.webview);

    this.panels.push(panel);

    panel.onDidDispose(
      () => {
        this.panels = this.panels.filter(p => p !== panel);
      },
      null,
      this.disposables,
    );
  }

  getHtmlForWebview(webview: vscode.Webview, distPath: string, mode: 'sidebar' | 'editor' = 'sidebar', requestData?: Record<string, unknown>): string {
    const htmlPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(htmlPath)) {
      return this._getErrorHtml('未找到 Webview 资源，请先运行: cd webview && npm run build');
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const cspSource = webview.cspSource;

    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'main.js')));
    const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'style.css')));

    const requestDataAttr = requestData ? ` data-request='${JSON.stringify(requestData).replace(/'/g, '&#39;')}'` : '';

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'nonce-${nonce}'; font-src ${cspSource} https:; img-src ${cspSource} https: data:; connect-src ${cspSource} https: http:;" />
  <link rel="stylesheet" href="${styleUri.toString()}" />
  <style>html,body,#root{height:100%;margin:0;padding:0;overflow:hidden;}</style>
  <title></title>
</head>
<body>
  <div id="root" data-mode="${mode}"${requestDataAttr}></div>
  <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;

    return html;
  }

  private _getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /></head>
<body style="padding:20px;font-family:sans-serif;color:#ccc;">
  <h2>ApiMate 错误</h2>
  <p>${message}</p>
</body>
</html>`;
  }

  sendMessageToWebview(message: WebviewMessage): void {
    for (const panel of this.panels) {
      void panel.webview.postMessage(message);
    }
    if (this.sidebarProvider?.view) {
      void this.sidebarProvider.view.webview.postMessage(message);
    }
  }

  sendMessageToSidebar(message: WebviewMessage): void {
    if (this.sidebarProvider?.view) {
      void this.sidebarProvider.view.webview.postMessage(message);
    }
  }

  get activePanels(): vscode.WebviewPanel[] {
    return this.panels;
  }

  onMessage(type: MessageType, handler: MessageHandler): vscode.Disposable {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    const list = this.messageHandlers.get(type) ?? [];
    list.push(handler);
    this.messageHandlers.set(type, list);
    return new vscode.Disposable(() => {
      const existing = this.messageHandlers.get(type);
      if (existing) {
        const index = existing.indexOf(handler);
        if (index !== -1) {
          existing.splice(index, 1);
        }
      }
    });
  }

  handleWebviewMessage(message: WebviewMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers && handlers.length > 0) {
      for (const handler of handlers) {
        void handler(message);
      }
    }
  }

  attachMessageListenerToWebview(webview: vscode.Webview): void {
    const disposable = webview.onDidReceiveMessage(
      (message: WebviewMessage) => { this.handleWebviewMessage(message); },
      null,
      this.disposables,
    );
    this.disposables.push(disposable);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.messageHandlers.clear();

    for (const panel of this.panels) {
      panel.dispose();
    }
    this.panels = [];
  }
}
