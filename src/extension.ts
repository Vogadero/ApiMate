import * as vscode from 'vscode';
import * as fs from 'fs';
import { RequestManager } from './managers/RequestManager';
import { CollectionManager } from './managers/CollectionManager';
import { StorageManager } from './managers/StorageManager';
import { EnvironmentManager } from './managers/EnvironmentManager';
import { AuthManager } from './managers/AuthManager';
import { VariableResolver } from './managers/VariableResolver';
import { ScriptEngine } from './managers/ScriptEngine';
import { TestRunner } from './managers/TestRunner';
import { HttpProtocolHandler, GrpcProtocolHandler, WebSocketHandler, SSEHandler } from './managers/ProtocolHandler';
import { ImportExportManager } from './managers/ImportExportManager';
import { UIManager } from './managers/UIManager';
import { HistoryManager } from './managers/HistoryManager';
import { ApiMateCodeLensProvider } from './CodeLensProvider';

class ApiMateExtension {
  private requestManager!: RequestManager;
  private collectionManager!: CollectionManager;
  private storageManager: StorageManager | undefined;
  private environmentManager!: EnvironmentManager;
  private authManager!: AuthManager;
  private variableResolver!: VariableResolver;
  private scriptEngine!: ScriptEngine;
  private testRunner!: TestRunner;
  private httpHandler!: HttpProtocolHandler;
  private grpcHandler!: GrpcProtocolHandler;
  private wsHandler!: WebSocketHandler;
  private sseHandler!: SSEHandler;
  private importExportManager!: ImportExportManager;
  private uiManager!: UIManager;
  private historyManager!: HistoryManager;
  private statusBarItem!: vscode.StatusBarItem;
  private outputChannel!: vscode.OutputChannel;
  private context!: vscode.ExtensionContext;

  activate(context: vscode.ExtensionContext): void {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('ApiMate');

    this.requestManager = new RequestManager(context);
    this.collectionManager = new CollectionManager();
    this.environmentManager = new EnvironmentManager();
    this.authManager = new AuthManager();
    this.variableResolver = new VariableResolver();
    this.scriptEngine = new ScriptEngine(context);
    this.testRunner = new TestRunner(this.scriptEngine);
    this.httpHandler = new HttpProtocolHandler();
    this.grpcHandler = new GrpcProtocolHandler();
    this.wsHandler = new WebSocketHandler();
    this.sseHandler = new SSEHandler();
    this.importExportManager = new ImportExportManager(context);
    this.uiManager = new UIManager(context);
    this.historyManager = new HistoryManager(
      vscode.workspace.getConfiguration('apimate').get<number>('historyLimit') ?? 100,
    );

    try {
      this.storageManager = new StorageManager(context);
      this._loadPersistedData(context);
    } catch {
      this.outputChannel.appendLine('未找到工作区文件夹 — 以无文件持久化模式运行');
    }

    this._setupStatusBar(context);
    this._setupCodeLens(context);
    this._registerCommands(context);
    this._registerMessageHandlers();
    this._setupFileWatchers(context);

    this.uiManager.registerSidebarProvider();

    this.outputChannel.appendLine('ApiMate 已激活');
  }

  private async _loadPersistedData(context: vscode.ExtensionContext): Promise<void> {
    if (!this.storageManager) { return; }
    try {
      const collections = await this.storageManager.loadCollections();
      this.collectionManager.setCollections(collections);
      const environments = await this.storageManager.loadAllEnvironmentsWithSecrets();
      this.environmentManager.setEnvironments(environments);
      const globalVars = await this.storageManager.loadGlobalVariables();
      this.environmentManager.setGlobalVariables(globalVars);
      const historyData = context.workspaceState.get<{ history: import('./managers/HistoryManager').HistoryEntry[] }>('apimate.history');
      if (historyData) { this.historyManager.fromJSON(historyData); }
      const defaultEnvId = vscode.workspace.getConfiguration('apimate').get<string>('defaultEnvironment');
      if (defaultEnvId) {
        try { this.environmentManager.setActiveEnvironment(defaultEnvId); }
        catch { this.outputChannel.appendLine(`默认环境 "${defaultEnvId}" 未找到`); }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`加载持久化数据失败: ${msg}`);
    }
  }

  private _setupStatusBar(context: vscode.ExtensionContext): void {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'apimate.openRequest';
    this.statusBarItem.text = '$(globe) ApiMate';
    this.statusBarItem.tooltip = 'ApiMate - 无活动请求';
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);
  }

  private _setupCodeLens(context: vscode.ExtensionContext): void {
    const enabled = vscode.workspace.getConfiguration('apimate').get<boolean>('enableCodeLens') ?? true;
    if (enabled) {
      const provider = new ApiMateCodeLensProvider();
      for (const lang of ['typescript', 'javascript', 'python', 'java']) {
        context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: lang, scheme: 'file' }, provider));
      }
    }
  }

  private _registerCommands(context: vscode.ExtensionContext): void {
    const commands: [string, (...args: unknown[]) => unknown][] = [
      ['apimate.newRequest', () => this._cmdNewRequest()],
      ['apimate.newCollection', () => this._cmdNewCollection()],
      ['apimate.newFolder', () => this._cmdNewFolder()],
      ['apimate.openRequest', () => this._cmdOpenRequest()],
      ['apimate.sendRequest', () => this._cmdSendRequest()],
      ['apimate.duplicateRequest', (node) => this._cmdDuplicateRequest(node)],
      ['apimate.deleteRequest', (node) => this._cmdDeleteRequest(node)],
      ['apimate.renameRequest', (node) => this._cmdRenameRequest(node)],
      ['apimate.deleteCollection', (node) => this._cmdDeleteCollection(node)],
      ['apimate.renameCollection', (node) => this._cmdRenameCollection(node)],
      ['apimate.deleteFolder', (node) => this._cmdDeleteFolder(node)],
      ['apimate.renameFolder', (node) => this._cmdRenameFolder(node)],
      ['apimate.importCollection', () => this._cmdImportCollectionViaWebview()],
      ['apimate.exportCollection', (node) => this._cmdExportCollection(node)],
      ['apimate.importCurl', () => this._cmdImportCurl()],
      ['apimate.importOpenAPI', () => this._cmdImportOpenAPI()],
      ['apimate.importHAR', () => this._cmdImportHAR()],
      ['apimate.switchEnvironment', () => this._cmdSwitchEnvironment()],
      ['apimate.manageEnvironments', () => this._cmdManageEnvironments()],
      ['apimate.newEnvironment', () => this._cmdNewEnvironment()],
      ['apimate.runCollection', (node) => this._cmdRunCollection(node)],
      ['apimate.clearHistory', () => this._cmdClearHistory()],
      ['apimate.testApi', (url, method) => this._cmdTestApi(String(url), String(method))],
      ['apimate.saveResponse', () => this._cmdSaveResponse()],
      ['apimate.copyResponse', () => this._cmdCopyResponse()],
      ['apimate.exportAsCurl', () => this._cmdExportAsCurl()],
      ['apimate.viewCookies', () => this._cmdViewCookies()],
      ['apimate.clearCookies', () => this._cmdClearCookies()],
      ['apimate.refreshData', () => this._sendDataToWebview()],
      ['apimate.showShortcuts', () => { const path = require('path'); const icon3Path = path.join(this.context.extensionPath, 'resources', 'icon3.png'); const iconPath = vscode.Uri.file(icon3Path); const panel = vscode.window.createWebviewPanel('apimate-shortcuts', 'ApiMate 快捷键', vscode.ViewColumn.Beside, { enableScripts: false }); panel.iconPath = iconPath; panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:var(--vscode-font-family);padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background);}h2{color:var(--vscode-foreground);margin-bottom:16px;}table{width:100%;border-collapse:collapse;}td{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);}td:first-child{font-family:monospace;font-weight:600;color:var(--vscode-textLink-activeForeground);white-space:nowrap;}td:last-child{color:var(--vscode-descriptionForeground);}</style></head><body><h2>ApiMate 快捷键 / Keyboard Shortcuts</h2><table><tr><td>Ctrl+Enter</td><td>发送请求 / Send request</td></tr><tr><td>Ctrl+S</td><td>保存请求 / Save request</td></tr><tr><td>Ctrl+N</td><td>新建请求 / New request</td></tr><tr><td>Ctrl+Shift+C</td><td>导入 cURL / Import cURL</td></tr><tr><td>Ctrl+Shift+E</td><td>切换环境 / Switch environment</td></tr><tr><td>Ctrl+L</td><td>清空历史 / Clear history</td></tr></table></body></html>`; }],
      ['apimate.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', 'apimate')],
      ['apimate.viewLogs', () => this.outputChannel.show()],
      ['apimate.clearCache', () => { this.historyManager.clearAll(); this._sendDataToWebview(); vscode.window.showInformationMessage('缓存已清理'); }],
    ];
    for (const [id, handler] of commands) {
      context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    }
  }

  private _registerMessageHandlers(): void {
    this.uiManager.onMessage('sendRequest', async (msg) => {
      try {
        const request = msg.payload?.request;
        const historyEntryId = msg.payload?.historyEntryId;
        if (!request) { return; }
        this.statusBarItem.text = '$(loading~spin) ApiMate: 发送中...';
        this.statusBarItem.tooltip = '正在发送请求...';
        const response = await this.requestManager.sendRequest(request);
        if (response.cookies && response.cookies.length > 0) {
          for (const cookie of response.cookies) {
            this.authManager.storeCookie({ name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path || '/', expires: cookie.expires ? new Date(cookie.expires) : undefined, httpOnly: cookie.httpOnly ?? false, secure: cookie.secure ?? false });
          }
        }
        if (historyEntryId) {
          this.historyManager.updateEntryResponse(historyEntryId, { status: response.status, time: response.time, size: response.size });
        } else {
          this.historyManager.addEntry(request, response);
        }
        this.statusBarItem.text = `$(check) ApiMate: ${response.status} (${response.time}ms)`;
        this.statusBarItem.tooltip = `状态: ${response.status} | 耗时: ${response.time}ms | 大小: ${response.size}B`;
        this.uiManager.sendMessageToWebview({ type: 'requestComplete', payload: { requestId: request.id, response } });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.statusBarItem.text = '$(error) ApiMate: 错误';
        this.statusBarItem.tooltip = errorMsg;
        this.uiManager.sendMessageToWebview({ type: 'requestComplete', payload: { requestId: msg.payload?.request?.id, error: errorMsg } });
      }
    });

    this.uiManager.onMessage('saveRequest', async (msg) => {
      const { request, collectionId, folderId } = msg.payload ?? {};
      if (!request || !collectionId) { return; }
      if (!request.createdAt) { request.createdAt = Date.now(); }
      this.collectionManager.addRequest(collectionId, folderId ?? null, request);
      await this._saveCollectionById(collectionId);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteRequest', async (msg) => {
      const { requestId } = msg.payload ?? {};
      if (!requestId) { return; }
      const collection = this.collectionManager.getCollections().find((c) => {
        return c.requests.some((r) => r.id === requestId) || c.folders.some((f) => f.requests.some((r) => r.id === requestId));
      });
      this.collectionManager.deleteRequest(requestId);
      if (collection) { await this._saveCollectionById(collection.id); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('createCollection', async (msg) => {
      const { name } = msg.payload ?? {};
      if (!name) { return; }
      const collection = this.collectionManager.createCollection(name);
      await this._saveCollectionById(collection.id);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteCollection', async (msg) => {
      const { collectionId } = msg.payload ?? {};
      if (!collectionId) { return; }
      this.collectionManager.deleteCollection(collectionId);
      if (this.storageManager) { await this.storageManager.deleteCollection(collectionId); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('importCollection', async (msg) => {
      const { format } = msg.payload ?? {};
      if (format && format !== 'curl') {
        await this._cmdImportCollectionWithFormat(format);
      } else {
        await this._cmdImportCollection();
      }
    });

    this.uiManager.onMessage('exportCollection', async (msg) => {
      const { collectionId, format } = msg.payload ?? {};
      if (!collectionId) { return; }
      const collection = this.collectionManager.getCollection(collectionId);
      if (!collection) { return; }
      const content = format === 'postman'
        ? this.importExportManager.exportCollectionAsPostman(collection)
        : this.importExportManager.exportCollectionAsApimate(collection);
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${collection.name}.${format === 'postman' ? 'postman' : 'apimate'}.json`),
        filters: { JSON: ['json'] },
      });
      if (uri) {
        fs.writeFileSync(uri.fsPath, content, 'utf-8');
        vscode.window.showInformationMessage(`集合已导出至 ${uri.fsPath}`);
      }
    });

    this.uiManager.onMessage('switchEnvironment', (msg) => {
      const { environmentId } = msg.payload ?? {};
      if (!environmentId) { this.environmentManager.clearActiveEnvironment(); }
      else { try { this.environmentManager.setActiveEnvironment(environmentId); } catch { this.outputChannel.appendLine(`环境 "${environmentId}" 未找到`); } }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('updateVariable', async (msg) => {
      const { environmentId, variable } = msg.payload ?? {};
      if (!environmentId || !variable) { return; }
      this.environmentManager.setVariable(environmentId, variable);
      if (this.storageManager) {
        const env = this.environmentManager.getEnvironmentById(environmentId);
        if (env) { await this.storageManager.saveEnvironment(env); }
      }
    });

    this.uiManager.onMessage('runCollection', async (msg) => {
      const { collectionId, parallel, stopOnFailure, delay, iterationData, maxParallel } = msg.payload ?? {};
      if (!collectionId) { return; }
      const configMaxParallel = vscode.workspace.getConfiguration('apimate').get<number>('maxParallel', 5);
      const effectiveMaxParallel = maxParallel ?? configMaxParallel;
      try {
        const result = await this.testRunner.runCollection({ collectionId, environment: this.environmentManager, parallel: parallel ?? true, stopOnFailure: stopOnFailure ?? false, delay: delay ?? 0, iterationData, maxParallel: effectiveMaxParallel }, this.collectionManager);
        this.uiManager.sendMessageToWebview({ type: 'collectionRunResult', payload: { result } });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`集合运行失败: ${errorMsg}`);
      }
    });

    this.uiManager.onMessage('clearHistory', () => { this.historyManager.clearAll(); this._sendDataToWebview(); });
    this.uiManager.onMessage('loadData', () => { this._sendDataToWebview(); });
    this.uiManager.onMessage('importCurl', async (msg) => {
      const curlCommand = msg?.payload?.curl || await vscode.window.showInputBox({ prompt: '粘贴 cURL 命令', placeHolder: 'curl https://api.example.com/users' });
      if (!curlCommand) { return; }
      const raw = msg?.payload?.raw ?? false;
      try {
        const request = await this.importExportManager.importCurl(curlCommand, raw);
        this.uiManager.createWebviewPanel({ request });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`cURL 导入失败: ${errorMsg}`);
      }
    });
    this.uiManager.onMessage('openEditor', (msg) => {
      const request = msg.payload?.request;
      const autoSend = msg.payload?.autoSend;
      if (request) {
        this.uiManager.createWebviewPanel({ request, autoSend });
      }
    });

    this.uiManager.onMessage('openInEditor', async (msg) => {
      const { content, language } = msg.payload ?? {};
      if (!content) { return; }
      try {
        const doc = await vscode.workspace.openTextDocument({ content, language: language ?? 'json' });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`打开编辑器失败: ${errorMsg}`);
      }
    });

    this.uiManager.onMessage('viewCookies', async () => { await this._cmdViewCookies(); });
    this.uiManager.onMessage('viewLogs', () => { this.outputChannel.show(); });
    this.uiManager.onMessage('clearCache', async () => {
      this.historyManager.clearAll();
      this._sendDataToWebview();
      vscode.window.showInformationMessage('缓存已清理');
    });
    this.uiManager.onMessage('showShortcuts', () => {
      const path = require('path');
      const icon3Path = path.join(this.context.extensionPath, 'resources', 'icon3.png');
      const iconPath = vscode.Uri.file(icon3Path);
      const panel = vscode.window.createWebviewPanel('apimate-shortcuts', 'ApiMate 快捷键', vscode.ViewColumn.Beside, { enableScripts: false });
      panel.iconPath = iconPath;
      panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body{font-family:var(--vscode-font-family);padding:20px;color:var(--vscode-foreground);background:var(--vscode-editor-background);}
        h2{color:var(--vscode-foreground);margin-bottom:16px;}
        table{width:100%;border-collapse:collapse;}
        td{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);}
        td:first-child{font-family:monospace;font-weight:600;color:var(--vscode-textLink-activeForeground);white-space:nowrap;}
        td:last-child{color:var(--vscode-descriptionForeground);}
      </style></head><body>
        <h2>ApiMate 快捷键 / Keyboard Shortcuts</h2>
        <table>
          <tr><td>Ctrl+Enter</td><td>发送请求 / Send request</td></tr>
          <tr><td>Ctrl+S</td><td>保存请求 / Save request</td></tr>
          <tr><td>Ctrl+N</td><td>新建请求 / New request</td></tr>
          <tr><td>Ctrl+Shift+C</td><td>导入 cURL / Import cURL</td></tr>
          <tr><td>Ctrl+Shift+E</td><td>切换环境 / Switch environment</td></tr>
          <tr><td>Ctrl+L</td><td>清空历史 / Clear history</td></tr>
        </table>
      </body></html>`;
    });
    this.uiManager.onMessage('openSettings', () => { vscode.commands.executeCommand('workbench.action.openSettings', 'apimate'); });

    this.uiManager.onMessage('clearCookies', () => {
      this.authManager.clearAllCookies();
      vscode.window.showInformationMessage('已清除所有 Cookie');
    });

    this.uiManager.onMessage('deleteCookie', (msg) => {
      const { name, domain } = msg.payload ?? {};
      if (name && domain) {
        this.authManager.deleteCookie(name, domain);
        vscode.window.showInformationMessage(`已删除 Cookie: ${name}`);
      }
    });

    this.uiManager.onMessage('selectFile', async (msg) => {
      const { index } = msg.payload ?? {};
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        title: '选择文件 / Select File',
      });
      if (uris && uris.length > 0) {
        const filePath = uris[0]!.fsPath;
        const fileName = require('path').basename(filePath);
        this.uiManager.sendMessageToWebview({
          type: 'fileSelected',
          payload: { index, filename: fileName, path: filePath },
        });
      }
    });

    this.uiManager.onMessage('renameHistoryEntry', (msg) => {
      const { id, name } = msg.payload ?? {};
      if (!id || !name) { return; }
      this.historyManager.renameEntry(id, name);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteHistoryEntry', (msg) => {
      const { id } = msg.payload ?? {};
      if (!id) { return; }
      this.historyManager.deleteEntry(id);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('copyHistoryEntry', (msg) => {
      const { request } = msg.payload ?? {};
      if (!request) { return; }
      this.historyManager.addCopiedEntry(request);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('pinHistoryEntry', (msg) => {
      const { id } = msg.payload ?? {};
      if (!id) { return; }
      this.historyManager.pinEntry?.(id);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('pinRequest', async (msg) => {
      const { requestId } = msg.payload ?? {};
      if (!requestId) { return; }
      this.collectionManager.pinRequest(requestId);
      const loc = this.collectionManager.getCollections().find((c) =>
        c.requests.some((r) => r.id === requestId) || c.folders.some((f) => f.requests.some((r) => r.id === requestId))
      );
      if (loc) { await this._saveCollectionById(loc.id); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('createEnvironment', async (msg) => {
      const { name, scope } = msg.payload ?? {};
      if (!name) { return; }
      const env = this.environmentManager.createEnvironment(name);
      if (this.storageManager) { await this.storageManager.saveEnvironment(env); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('importEnvironment', async (msg) => {
      const { environment } = msg.payload ?? {};
      if (!environment) { return; }
      this.environmentManager.setEnvironments([...this.environmentManager.getEnvironments(), environment]);
      if (this.storageManager) { await this.storageManager.saveEnvironment(environment); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteEnvironment', async (msg) => {
      const { environmentId } = msg.payload ?? {};
      if (!environmentId) { return; }
      this.environmentManager.deleteEnvironment(environmentId);
      if (this.storageManager) { await this.storageManager.deleteEnvironment(environmentId); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('addEnvironmentVariable', async (msg) => {
      const { environmentId, key, value } = msg.payload ?? {};
      if (!environmentId) { return; }
      this.environmentManager.setVariable(environmentId, { key, value, type: 'default', enabled: true });
      if (this.storageManager) {
        const env = this.environmentManager.getEnvironmentById(environmentId);
        if (env) { await this.storageManager.saveEnvironment(env); }
      }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteEnvironmentVariable', async (msg) => {
      const { environmentId, key } = msg.payload ?? {};
      if (!environmentId || !key) { return; }
      this.environmentManager.deleteVariable?.(environmentId, key);
      if (this.storageManager) {
        const env = this.environmentManager.getEnvironmentById(environmentId);
        if (env) { await this.storageManager.saveEnvironment(env); }
      }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('duplicateEnvironment', async (msg) => {
      const { environmentId } = msg.payload ?? {};
      if (!environmentId) { return; }
      const duplicate = this.environmentManager.duplicateEnvironment(environmentId);
      if (duplicate && this.storageManager) { await this.storageManager.saveEnvironment(duplicate); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('renameEnvironment', async (msg) => {
      const { environmentId, name } = msg.payload ?? {};
      if (!environmentId || !name) { return; }
      this.environmentManager.renameEnvironment(environmentId, name);
      if (this.storageManager) {
        const env = this.environmentManager.getEnvironmentById(environmentId);
        if (env) { await this.storageManager.saveEnvironment(env); }
      }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('updateGlobalVariable', async (msg) => {
      const { variable } = msg.payload ?? {};
      if (!variable) { return; }
      this.environmentManager.setGlobalVariable(variable);
      if (this.storageManager) { await this.storageManager.saveGlobalVariables(this.environmentManager.getGlobalVariables()); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteGlobalVariable', async (msg) => {
      const { key } = msg.payload ?? {};
      if (!key) { return; }
      this.environmentManager.deleteGlobalVariable(key);
      if (this.storageManager) { await this.storageManager.saveGlobalVariables(this.environmentManager.getGlobalVariables()); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('importEnvFile', async (msg) => {
      const { content, environmentId } = msg.payload ?? {};
      if (!content) { return; }
      const variables = this.storageManager!.parseEnvFile(content);
      if (environmentId) {
        for (const v of variables) {
          this.environmentManager.setVariable(environmentId, v);
        }
        if (this.storageManager) {
          const env = this.environmentManager.getEnvironmentById(environmentId);
          if (env) { await this.storageManager.saveEnvironment(env); }
        }
      } else {
        const envName = msg.payload?.name || 'Imported from .env';
        const env = this.environmentManager.createEnvironment(envName);
        for (const v of variables) {
          this.environmentManager.setVariable(env.id, v);
        }
        if (this.storageManager) { await this.storageManager.saveEnvironment(env); }
      }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('renameCollection', async (msg) => {
      const { collectionId, name } = msg.payload ?? {};
      if (!collectionId || !name) { return; }
      const collection = this.collectionManager.getCollection(collectionId);
      if (collection) { collection.name = name; await this._saveCollectionById(collectionId); this._sendDataToWebview(); }
    });

    this.uiManager.onMessage('duplicateCollection', async (msg) => {
      const { collectionId } = msg.payload ?? {};
      if (!collectionId) { return; }
      const original = this.collectionManager.getCollection(collectionId);
      if (!original) { return; }
      const allNames = this.collectionManager.getCollections().map((c) => c.name);
      let copyName = original.name + ' (Copy)';
      let n = 2;
      while (allNames.includes(copyName)) {
        copyName = `${original.name} (Copy${n})`;
        n++;
      }
      const newCollection = this.collectionManager.createCollection(copyName);
      newCollection.folders = JSON.parse(JSON.stringify(original.folders));
      newCollection.requests = JSON.parse(JSON.stringify(original.requests));
      await this._saveCollectionById(newCollection.id);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('addFolder', async (msg) => {
      const { collectionId, name, parentFolderId } = msg.payload ?? {};
      if (!collectionId || !name) { return; }
      try {
        this.collectionManager.addFolder(collectionId, parentFolderId ?? null, name);
        await this._saveCollectionById(collectionId);
        this._sendDataToWebview();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showWarningMessage(errorMsg);
      }
    });

    this.uiManager.onMessage('renameFolder', async (msg) => {
      const { folderId, name } = msg.payload ?? {};
      if (!folderId || !name) { return; }
      this.collectionManager.renameFolder(folderId, name);
      const loc = this.collectionManager.getCollections().find((c) => c.folders.some((f) => f.id === folderId));
      if (loc) { await this._saveCollectionById(loc.id); }
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('deleteFolder', async (msg) => {
      const { folderId } = msg.payload ?? {};
      if (!folderId) { return; }
      this.collectionManager.deleteFolder(folderId);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('addRequestToCollection', async (msg) => {
      const { collectionId, folderId, request } = msg.payload ?? {};
      if (!collectionId || !request) { return; }
      this.collectionManager.addRequest(collectionId, folderId ?? null, request);
      await this._saveCollectionById(collectionId);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('duplicateRequest', (msg) => {
      const { requestId } = msg.payload ?? {};
      if (!requestId) { return; }
      this.collectionManager.duplicateRequest(requestId);
      this._sendDataToWebview();
    });

    this.uiManager.onMessage('renameRequest', async (msg) => {
      const { requestId, name } = msg.payload ?? {};
      if (!requestId || !name) { return; }
      const collection = this.collectionManager.getCollections().find((c) => {
        return c.requests.some((r) => r.id === requestId) || c.folders.some((f) => f.requests.some((r) => r.id === requestId));
      });
      this.collectionManager.renameRequest(requestId, name);
      if (collection) { await this._saveCollectionById(collection.id); }
      this._sendDataToWebview();
    });
  }

  private _setupFileWatchers(context: vscode.ExtensionContext): void {
    if (!this.storageManager) { return; }
    const collectionWatcher = this.storageManager.watchCollectionFiles({
      onChange: (collection) => { if (this.collectionManager.getCollection(collection.id)) { this.collectionManager.setCollections(this.collectionManager.getCollections().map((c) => c.id === collection.id ? collection : c)); } this._sendDataToWebview(); },
      onCreate: (collection) => { if (!this.collectionManager.getCollection(collection.id)) { this.collectionManager.setCollections([...this.collectionManager.getCollections(), collection]); } this._sendDataToWebview(); },
      onDelete: (collectionId) => { this.collectionManager.deleteCollection(collectionId); this._sendDataToWebview(); },
    });
    context.subscriptions.push(collectionWatcher);
    const envWatcher = this.storageManager.watchEnvironmentFiles({
      onChange: (environment) => { this.environmentManager.setEnvironments(this.environmentManager.getEnvironments().map((e) => e.id === environment.id ? environment : e)); this._sendDataToWebview(); },
      onCreate: (environment) => { if (!this.environmentManager.getEnvironmentById(environment.id)) { this.environmentManager.setEnvironments([...this.environmentManager.getEnvironments(), environment]); } this._sendDataToWebview(); },
      onDelete: (environmentId) => { this.environmentManager.deleteEnvironment(environmentId); this._sendDataToWebview(); },
    });
    context.subscriptions.push(envWatcher);
  }

  private _sendDataToWebview(): void {
    const maxParallel = vscode.workspace.getConfiguration('apimate').get<number>('maxParallel', 5);
    this.uiManager.sendMessageToWebview({
      type: 'dataLoaded',
      payload: { collections: this.collectionManager.getCollections(), environments: this.environmentManager.getEnvironments(), history: this.historyManager.getEntries(), activeEnvironmentId: this.environmentManager.getActiveEnvironment()?.id, globalVariables: this.environmentManager.getGlobalVariables(), maxParallel },
    });
  }

  private async _saveCollectionById(collectionId: string): Promise<void> {
    if (!this.storageManager) { return; }
    const collection = this.collectionManager.getCollection(collectionId);
    if (collection) { await this.storageManager.saveCollection(collection); }
  }

  private async _cmdNewRequest(): Promise<void> {
    const request = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: '新建请求',
      method: 'GET',
      url: '',
      headers: {},
      queryParams: {},
    };
    this.uiManager.createWebviewPanel({ request });
  }

  private async _cmdNewCollection(): Promise<void> {
    const name = await vscode.window.showInputBox({ prompt: '集合名称', placeHolder: '我的集合' });
    if (!name) { return; }
    const collection = this.collectionManager.createCollection(name);
    await this._saveCollectionById(collection.id);
    this._sendDataToWebview();
    vscode.window.showInformationMessage(`集合 "${name}" 已创建`);
  }

  private async _cmdNewFolder(): Promise<void> {
    if (this.collectionManager.getCollections().length === 0) { vscode.window.showWarningMessage('请先创建一个集合'); return; }
    const name = await vscode.window.showInputBox({ prompt: '文件夹名称', placeHolder: '我的文件夹' });
    if (!name) { return; }
    const collectionId = await this._pickCollection();
    if (!collectionId) { return; }
    this.collectionManager.addFolder(collectionId, null, name);
    await this._saveCollectionById(collectionId);
    this._sendDataToWebview();
  }

  private _cmdOpenRequest(): void {
    const panels = this.uiManager.activePanels;
    if (panels.length > 0) {
      panels[panels.length - 1]!.reveal(vscode.ViewColumn.One);
    } else {
      const history = this.historyManager.getEntries();
      if (history.length > 0) {
        const latestEntry = history[0]!;
        this.uiManager.createWebviewPanel({ request: latestEntry.request });
      } else {
        this.uiManager.createWebviewPanel();
      }
    }
  }

  private _cmdSendRequest(): void { this.uiManager.createWebviewPanel(); this.uiManager.sendMessageToWebview({ type: 'triggerSendRequest', payload: {} }); }

  private _cmdDuplicateRequest(node: unknown): void {
    const obj = node as Record<string, string> | undefined;
    const requestId = obj?.id ?? obj?.requestId;
    if (!requestId) { return; }
    this.collectionManager.duplicateRequest(requestId);
    this._sendDataToWebview();
  }

  private async _cmdDeleteRequest(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const requestId = obj?.id ?? obj?.requestId;
    if (!requestId) { return; }
    const confirm = await vscode.window.showWarningMessage('确定删除此请求？', '删除', '取消');
    if (confirm !== '删除') { return; }
    this.collectionManager.deleteRequest(requestId);
    this._sendDataToWebview();
  }

  private async _cmdRenameRequest(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const requestId = obj?.id ?? obj?.requestId;
    if (!requestId) { return; }
    const newName = await vscode.window.showInputBox({ prompt: '新请求名称' });
    if (!newName) { return; }
    this.collectionManager.renameRequest(requestId, newName);
    this._sendDataToWebview();
  }

  private async _cmdDeleteCollection(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const collectionId = obj?.id ?? obj?.collectionId;
    if (!collectionId) { return; }
    const confirm = await vscode.window.showWarningMessage('确定删除此集合及其所有内容？', '删除', '取消');
    if (confirm !== '删除') { return; }
    this.collectionManager.deleteCollection(collectionId);
    if (this.storageManager) { await this.storageManager.deleteCollection(collectionId); }
    this._sendDataToWebview();
  }

  private async _cmdRenameCollection(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const collectionId = obj?.id ?? obj?.collectionId;
    if (!collectionId) { return; }
    const newName = await vscode.window.showInputBox({ prompt: '新集合名称' });
    if (!newName) { return; }
    const collection = this.collectionManager.getCollection(collectionId);
    if (collection) { collection.name = newName; await this._saveCollectionById(collectionId); this._sendDataToWebview(); }
  }

  private async _cmdDeleteFolder(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const folderId = obj?.id ?? obj?.folderId;
    if (!folderId) { return; }
    const confirm = await vscode.window.showWarningMessage('确定删除此文件夹及其所有内容？', '删除', '取消');
    if (confirm !== '删除') { return; }
    this.collectionManager.deleteFolder(folderId);
    this._sendDataToWebview();
  }

  private async _cmdRenameFolder(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const folderId = obj?.id ?? obj?.folderId;
    if (!folderId) { return; }
    const newName = await vscode.window.showInputBox({ prompt: '新文件夹名称' });
    if (!newName) { return; }
    this.collectionManager.renameFolder(folderId, newName);
    this._sendDataToWebview();
  }

  private async _cmdImportCollectionViaWebview(): Promise<void> {
    this.uiManager.sendMessageToSidebar({ type: 'showImportDialog', payload: {} });
  }

  private async _cmdImportCollection(): Promise<void> {
    const format = await vscode.window.showQuickPick([
      { label: 'Postman 集合 v2.1', value: 'postman' },
      { label: 'OpenAPI / Swagger', value: 'openapi' },
      { label: 'HAR 文件', value: 'har' },
    ], { placeHolder: '选择导入格式' });
    if (!format) { return; }
    const filters: Record<string, string[]> = format.value === 'openapi' ? { OpenAPI: ['json', 'yaml', 'yml'] } : format.value === 'har' ? { HAR: ['har'] } : { Postman: ['json'] };
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters, title: `导入 ${format.label}` });
    if (!uris || uris.length === 0) { return; }
    const filePath = uris[0]!.fsPath;
    let result;
    switch (format.value) {
      case 'postman': result = await this.importExportManager.importPostmanCollection(filePath); break;
      case 'openapi': result = await this.importExportManager.importOpenAPI(filePath); break;
      case 'har': result = await this.importExportManager.importHAR(filePath); break;
    }
    if (result?.success && result.collection) {
      this.collectionManager.setCollections([...this.collectionManager.getCollections(), result.collection]);
      await this._saveCollectionById(result.collection.id);
      if (result.environments && this.storageManager) {
        for (const env of result.environments) { this.environmentManager.setEnvironments([...this.environmentManager.getEnvironments(), env]); await this.storageManager.saveEnvironment(env); }
      }
      this._sendDataToWebview();
      vscode.window.showInformationMessage(`已成功导入 "${result.collection.name}"`);
    } else if (result?.errors.length) {
      vscode.window.showErrorMessage(`导入失败: ${result.errors.join(', ')}`);
    }
  }

  private async _cmdImportCollectionWithFormat(format: string): Promise<void> {
    const filters: Record<string, string[]> = format === 'openapi' ? { OpenAPI: ['json', 'yaml', 'yml'] } : format === 'har' ? { HAR: ['har'] } : { Postman: ['json'] };
    const formatLabel = format === 'openapi' ? 'OpenAPI / Swagger' : format === 'har' ? 'HAR' : 'Postman';
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters, title: `导入 ${formatLabel}` });
    if (!uris || uris.length === 0) { return; }
    const filePath = uris[0]!.fsPath;
    let result;
    switch (format) {
      case 'postman': result = await this.importExportManager.importPostmanCollection(filePath); break;
      case 'openapi': result = await this.importExportManager.importOpenAPI(filePath); break;
      case 'har': result = await this.importExportManager.importHAR(filePath); break;
    }
    if (result?.success && result.collection) {
      this.collectionManager.setCollections([...this.collectionManager.getCollections(), result.collection]);
      await this._saveCollectionById(result.collection.id);
      if (result.environments && this.storageManager) {
        for (const env of result.environments) { this.environmentManager.setEnvironments([...this.environmentManager.getEnvironments(), env]); await this.storageManager.saveEnvironment(env); }
      }
      this._sendDataToWebview();
      vscode.window.showInformationMessage(`已成功导入 "${result.collection.name}"`);
    } else if (result?.errors.length) {
      vscode.window.showErrorMessage(`导入失败: ${result.errors.join(', ')}`);
    }
  }

  private async _cmdExportCollection(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const collectionId = obj?.id ?? obj?.collectionId;
    const collection = collectionId ? this.collectionManager.getCollection(collectionId) : await this._pickCollectionObj();
    if (!collection) { return; }
    const format = await vscode.window.showQuickPick([
      { label: 'ApiMate 格式', value: 'apimate' },
      { label: 'Postman 集合 v2.1', value: 'postman' },
    ], { placeHolder: '选择导出格式' });
    if (!format) { return; }
    const content = format.value === 'postman' ? this.importExportManager.exportCollectionAsPostman(collection) : this.importExportManager.exportCollectionAsApimate(collection);
    const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${collection.name}.json`), filters: { JSON: ['json'] } });
    if (uri) { fs.writeFileSync(uri.fsPath, content, 'utf-8'); vscode.window.showInformationMessage(`已导出至 ${uri.fsPath}`); }
  }

  private async _cmdImportCurl(): Promise<void> {
    this.uiManager.sendMessageToWebview({ type: 'showCurlImport' });
  }

  private async _cmdImportOpenAPI(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { OpenAPI: ['json', 'yaml', 'yml'] }, title: '导入 OpenAPI 规范' });
    if (!uris || uris.length === 0) { return; }
    const result = await this.importExportManager.importOpenAPI(uris[0]!.fsPath);
    if (result.success && result.collection) {
      this.collectionManager.setCollections([...this.collectionManager.getCollections(), result.collection]);
      await this._saveCollectionById(result.collection.id);
      this._sendDataToWebview();
      vscode.window.showInformationMessage(`已从 OpenAPI 导入 "${result.collection.name}"`);
    } else { vscode.window.showErrorMessage(`OpenAPI 导入失败: ${result.errors.join(', ')}`); }
  }

  private async _cmdImportHAR(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { HAR: ['har'] }, title: '导入 HAR 文件' });
    if (!uris || uris.length === 0) { return; }
    const result = await this.importExportManager.importHAR(uris[0]!.fsPath);
    if (result.success && result.collection) {
      this.collectionManager.setCollections([...this.collectionManager.getCollections(), result.collection]);
      await this._saveCollectionById(result.collection.id);
      this._sendDataToWebview();
      vscode.window.showInformationMessage(`已从 HAR 导入 "${result.collection.name}"`);
    } else { vscode.window.showErrorMessage(`HAR 导入失败: ${result.errors.join(', ')}`); }
  }

  private async _cmdSwitchEnvironment(): Promise<void> {
    const environments = this.environmentManager.getEnvironments();
    const items = [{ label: '无环境', id: '' }, ...environments.map((e) => ({ label: e.name, id: e.id }))];
    const selected = await vscode.window.showQuickPick(items, { placeHolder: '选择环境' });
    if (!selected) { return; }
    if (selected.id === '') { this.environmentManager.clearActiveEnvironment(); }
    else { this.environmentManager.setActiveEnvironment(selected.id); }
    this._sendDataToWebview();
  }

  private _cmdManageEnvironments(): void {
    this.uiManager.createWebviewPanel();
    this.uiManager.sendMessageToWebview({ type: 'dataLoaded', payload: { showEnvironmentManager: true } });
  }

  private async _cmdNewEnvironment(): Promise<void> {
    const name = await vscode.window.showInputBox({ prompt: '环境名称', placeHolder: '开发环境' });
    if (!name) { return; }
    const env = this.environmentManager.createEnvironment(name);
    if (this.storageManager) { await this.storageManager.saveEnvironment(env); }
    this._sendDataToWebview();
    vscode.window.showInformationMessage(`环境 "${name}" 已创建`);
  }

  private async _cmdRunCollection(node: unknown): Promise<void> {
    const obj = node as Record<string, string> | undefined;
    const collectionId = obj?.id ?? obj?.collectionId ?? await this._pickCollection();
    if (!collectionId) { return; }
    const parallel = await vscode.window.showQuickPick(
      [{ label: '顺序执行', value: false }, { label: '并行执行', value: true }],
      { placeHolder: '选择执行模式' },
    );
    if (parallel === undefined) { return; }
    try {
      const result = await this.testRunner.runCollection({ collectionId, environment: this.environmentManager, parallel: parallel.value, stopOnFailure: false }, this.collectionManager);
      const totalTests = result.passedTests + result.failedTests;
      const summary = `集合运行完成: ${result.totalRequests} 个请求, ${totalTests} 个测试 (${result.passedTests} 通过, ${result.failedTests} 失败) 耗时 ${result.totalTime}ms`;
      this.outputChannel.appendLine(summary);
      if (result.failedTests > 0) { vscode.window.showWarningMessage(summary); }
      else { vscode.window.showInformationMessage(summary); }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`集合运行失败: ${errorMsg}`);
    }
  }

  private _cmdClearHistory(): void { this.historyManager.clearAll(); this._sendDataToWebview(); vscode.window.showInformationMessage('历史已清空'); }

  private _cmdTestApi(url: string, method: string): void {
    this.uiManager.createWebviewPanel();
    this.uiManager.sendMessageToWebview({ type: 'dataLoaded', payload: { testApi: { url, method } } });
  }

  private _cmdSaveResponse(): void { vscode.window.showInformationMessage('请先发送请求以保存响应'); }
  private _cmdCopyResponse(): void { vscode.window.showInformationMessage('请先发送请求以复制响应'); }
  private _cmdExportAsCurl(): void { vscode.window.showInformationMessage('请先打开请求以导出为 cURL'); }

  private async _cmdViewCookies(): Promise<void> {
    const cookies = this.authManager.getAllCookies();
    const path = require('path');
    const icon2Path = path.join(this.context.extensionPath, 'resources', 'icon2.png');
    const iconPath = vscode.Uri.file(icon2Path);
    const panel = vscode.window.createWebviewPanel('apimate-cookies', 'Cookie 管理', vscode.ViewColumn.Beside, { enableScripts: true });
    panel.iconPath = iconPath;
    const rows = cookies.length > 0
      ? cookies.map((c, i) => `<tr><td style="padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border);color:var(--vscode-textLink-active-color);font-weight:600">${c.name}</td><td style="padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border);font-family:monospace;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.value}</td><td style="padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border);font-size:12px;color:var(--vscode-descriptionForeground)">${c.domain}</td><td style="padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border);font-size:12px;color:var(--vscode-descriptionForeground)">${c.path || '/'}</td><td style="padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border)"><button onclick="deleteCookie(${i})" style="background:none;border:1px solid var(--vscode-errorForeground);color:var(--vscode-errorForeground);border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer">删除</button></td></tr>`).join('')
      : '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--vscode-descriptionForeground)">暂无存储的 Cookie</td></tr>';
    const cookieData = JSON.stringify(cookies.map((c: any) => ({ name: c.name, domain: c.domain })));
    panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0;padding:16px}table{width:100%;border-collapse:collapse;border:1px solid var(--vscode-panel-border);border-radius:8px;overflow:hidden}th{padding:8px 12px;text-align:left;background:var(--vscode-editor-inactiveSelectionBackground);font-size:12px;font-weight:600;border-bottom:2px solid var(--vscode-panel-border)}h2{font-size:16px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;gap:12px}.clear-btn{font-size:12px;padding:4px 12px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;border-radius:4px;cursor:pointer}.clear-btn:hover{background:var(--vscode-button-secondaryHoverBackground)}</style></head><body><h2>Cookie 管理${cookies.length > 0 ? '<button class="clear-btn" onclick="clearCookies()">清除所有 Cookie</button>' : ''}</h2><table><thead><tr><th>名称</th><th>值</th><th>域名</th><th>路径</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table><script>const vscode=acquireVsCodeApi();const cookies=${cookieData};function clearCookies(){vscode.postMessage({type:'clearCookies'})}function deleteCookie(i){const c=cookies[i];if(c)vscode.postMessage({type:'deleteCookie',name:c.name,domain:c.domain})}</script></body></html>`;
    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'clearCookies') {
        this.authManager.clearAllCookies();
        vscode.window.showInformationMessage('已清除所有 Cookie');
        panel.dispose();
      }
      if (msg.type === 'deleteCookie' && msg.name && msg.domain) {
        this.authManager.deleteCookie(msg.name, msg.domain);
        vscode.window.showInformationMessage(`已删除 Cookie: ${msg.name}`);
        panel.dispose();
        this._cmdViewCookies();
      }
    });
  }

  private _cmdClearCookies(): void {
    for (const cookie of this.authManager.getAllCookies()) { this.authManager.deleteCookie(cookie.name, cookie.domain); }
    vscode.window.showInformationMessage('所有 Cookie 已清除');
  }

  private async _pickCollection(): Promise<string | undefined> {
    const collections = this.collectionManager.getCollections();
    if (collections.length === 0) { return undefined; }
    const selected = await vscode.window.showQuickPick(collections.map((c) => ({ label: c.name, id: c.id })), { placeHolder: '选择集合' });
    return selected?.id;
  }

  private async _pickCollectionObj(): Promise<import('./managers/CollectionManager').Collection | undefined> {
    const collections = this.collectionManager.getCollections();
    if (collections.length === 0) { return undefined; }
    const selected = await vscode.window.showQuickPick(collections.map((c) => ({ label: c.name, collection: c })), { placeHolder: '选择集合' });
    return selected?.collection;
  }

  deactivate(): void {
    this.grpcHandler.dispose();
    this.wsHandler.dispose();
    this.sseHandler.dispose();
    this.uiManager.dispose();
    this.outputChannel.dispose();
  }
}

const extension = new ApiMateExtension();
export function activate(context: vscode.ExtensionContext): void { extension.activate(context); }
export function deactivate(): void { extension.deactivate(); }
