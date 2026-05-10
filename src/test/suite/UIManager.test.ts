import * as assert from 'assert';
import * as path from 'path';
import { UIManager, WebviewMessage, MessageType } from '../../managers/UIManager';

// Minimal mock for vscode.ExtensionContext
function createMockContext(extensionPath?: string): any {
  return {
    subscriptions: [],
    globalState: {},
    workspaceState: {},
    secrets: {},
    extensionPath: extensionPath ?? '',
  };
}

// Minimal mock for vscode.WebviewPanel
function createMockPanel(): any {
  const listeners: Array<(msg: WebviewMessage) => void> = [];
  const postedMessages: WebviewMessage[] = [];

  return {
    webview: {
      postMessage(msg: WebviewMessage) {
        postedMessages.push(msg);
      },
      onDidReceiveMessage(
        listener: (msg: WebviewMessage) => void,
        _thisArg: any,
        disposables: any[]
      ) {
        listeners.push(listener);
        const disposable = { dispose: () => {} };
        if (disposables) {
          disposables.push(disposable);
        }
        return disposable;
      },
    },
    dispose() {},
    // Test helpers
    _listeners: listeners,
    _postedMessages: postedMessages,
    simulateMessage(msg: WebviewMessage) {
      for (const l of listeners) {
        l(msg);
      }
    },
  };
}

suite('UIManager - Message Passing Bridge', () => {
  test('sendMessageToWebview posts message to panel', () => {
    const manager = new UIManager(createMockContext());
    const panel = createMockPanel();
    // Inject panel via protected accessor for testing
    (manager as any).panel = panel;

    const msg: WebviewMessage = { type: 'requestComplete', payload: { status: 200 } };
    manager.sendMessageToWebview(msg);

    assert.strictEqual(panel._postedMessages.length, 1);
    assert.deepStrictEqual(panel._postedMessages[0], msg);
  });

  test('sendMessageToWebview does nothing when panel is null', () => {
    const manager = new UIManager(createMockContext());
    // panel is null by default - should not throw
    assert.doesNotThrow(() => {
      manager.sendMessageToWebview({ type: 'dataLoaded', payload: {} });
    });
  });

  test('onMessage registers handler and receives dispatched messages', () => {
    const manager = new UIManager(createMockContext());
    const received: WebviewMessage[] = [];

    manager.onMessage('sendRequest', (msg) => { received.push(msg); });

    const msg: WebviewMessage = { type: 'sendRequest', payload: { url: 'https://example.com' } };
    manager.handleWebviewMessage(msg);

    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], msg);
  });

  test('multiple handlers for same type are all called', () => {
    const manager = new UIManager(createMockContext());
    let count = 0;

    manager.onMessage('saveRequest', () => { count++; });
    manager.onMessage('saveRequest', () => { count++; });

    manager.handleWebviewMessage({ type: 'saveRequest', payload: {} });

    assert.strictEqual(count, 2);
  });

  test('handler disposable removes the handler', () => {
    const manager = new UIManager(createMockContext());
    const received: WebviewMessage[] = [];

    const disposable = manager.onMessage('deleteRequest', (msg) => { received.push(msg); });
    disposable.dispose();

    manager.handleWebviewMessage({ type: 'deleteRequest', payload: {} });

    assert.strictEqual(received.length, 0);
  });

  test('handlers for different types do not interfere', () => {
    const manager = new UIManager(createMockContext());
    const sendReceived: WebviewMessage[] = [];
    const saveReceived: WebviewMessage[] = [];

    manager.onMessage('sendRequest', (msg) => { sendReceived.push(msg); });
    manager.onMessage('saveRequest', (msg) => { saveReceived.push(msg); });

    manager.handleWebviewMessage({ type: 'sendRequest', payload: {} });

    assert.strictEqual(sendReceived.length, 1);
    assert.strictEqual(saveReceived.length, 0);
  });

  test('attachMessageListener wires webview messages to handleWebviewMessage', () => {
    const manager = new UIManager(createMockContext());
    const panel = createMockPanel();
    const received: WebviewMessage[] = [];

    manager.onMessage('switchEnvironment', (msg) => { received.push(msg); });
    (manager as any).attachMessageListener(panel);

    const msg: WebviewMessage = { type: 'switchEnvironment', payload: { environmentId: 'env-1' } };
    panel.simulateMessage(msg);

    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], msg);
  });

  test('dispose clears handlers and panel', () => {
    const manager = new UIManager(createMockContext());
    const panel = createMockPanel();
    (manager as any).panel = panel;

    manager.onMessage('loadData', () => { /* no-op */ });
    manager.dispose();

    assert.strictEqual((manager as any).panel, null);
    assert.strictEqual((manager as any).messageHandlers.size, 0);
  });

  test('handleWebviewMessage does not throw for unregistered types', () => {
    const manager = new UIManager(createMockContext());
    assert.doesNotThrow(() => {
      manager.handleWebviewMessage({ type: 'clearHistory', payload: {} });
    });
  });

  test('all defined MessageTypes are handled without throwing', () => {
    const manager = new UIManager(createMockContext());
    const types: MessageType[] = [
      'sendRequest', 'saveRequest', 'deleteRequest', 'createCollection',
      'deleteCollection', 'importCollection', 'exportCollection',
      'switchEnvironment', 'updateVariable', 'runCollection',
      'clearHistory', 'loadData', 'requestComplete', 'dataLoaded',
    ];

    for (const type of types) {
      assert.doesNotThrow(() => {
        manager.handleWebviewMessage({ type, payload: {} });
      }, `Should not throw for type: ${type}`);
    }
  });
});

suite('UIManager - createWebviewPanel lifecycle', () => {
  // Resolve the actual extension root (two levels up from dist/test/suite/)
  const extensionPath = path.resolve(__dirname, '..', '..', '..');

  // Track created panels for cleanup
  const createdPanels: any[] = [];

  // Mock vscode.window.createWebviewPanel to avoid real VS Code API calls
  let originalCreateWebviewPanel: any;

  function createMockWebviewPanel(revealCalled: { value: boolean }): any {
    const listeners: Array<(msg: WebviewMessage) => void> = [];
    const panel: any = {
      webview: {
        html: '',
        cspSource: 'vscode-webview-resource:',
        postMessage(_msg: WebviewMessage) {},
        asWebviewUri(uri: any) { return uri; },
        onDidReceiveMessage(
          listener: (msg: WebviewMessage) => void,
          _thisArg: any,
          disposables: any[]
        ) {
          listeners.push(listener);
          const d = { dispose: () => {} };
          if (disposables) { disposables.push(d); }
          return d;
        },
      },
      reveal() { revealCalled.value = true; },
      onDidDispose(cb: () => void, _thisArg: any, disposables: any[]) {
        panel._disposeCallback = cb;
        const d = { dispose: () => {} };
        if (disposables) { disposables.push(d); }
        return d;
      },
      dispose() {
        if (panel._disposeCallback) { panel._disposeCallback(); }
      },
      _disposeCallback: null as (() => void) | null,
      _listeners: listeners,
    };
    createdPanels.push(panel);
    return panel;
  }

  setup(() => {
    // Patch vscode.window.createWebviewPanel
    const vscode = require('vscode');
    originalCreateWebviewPanel = vscode.window.createWebviewPanel;
  });

  teardown(() => {
    const vscode = require('vscode');
    vscode.window.createWebviewPanel = originalCreateWebviewPanel;
    createdPanels.length = 0;
  });

  test('createWebviewPanel creates a panel and sets HTML content', () => {
    const vscode = require('vscode');
    const revealCalled = { value: false };
    vscode.window.createWebviewPanel = () => createMockWebviewPanel(revealCalled);

    const manager = new UIManager(createMockContext(extensionPath));
    manager.createWebviewPanel();

    const panel = (manager as any).panel;
    assert.ok(panel, 'panel should be set after createWebviewPanel');
    assert.ok(panel.webview.html.length > 0, 'webview HTML should be populated');
    assert.ok(panel.webview.html.includes('<html'), 'HTML should contain html tag');
  });

  test('createWebviewPanel replaces {{cspSource}} placeholder', () => {
    const vscode = require('vscode');
    const revealCalled = { value: false };
    vscode.window.createWebviewPanel = () => createMockWebviewPanel(revealCalled);

    const manager = new UIManager(createMockContext(extensionPath));
    manager.createWebviewPanel();

    const html = (manager as any).panel.webview.html;
    assert.ok(!html.includes('{{cspSource}}'), 'cspSource placeholder should be replaced');
  });

  test('createWebviewPanel replaces {{nonce}} placeholder', () => {
    const vscode = require('vscode');
    const revealCalled = { value: false };
    vscode.window.createWebviewPanel = () => createMockWebviewPanel(revealCalled);

    const manager = new UIManager(createMockContext(extensionPath));
    manager.createWebviewPanel();

    const html = (manager as any).panel.webview.html;
    assert.ok(!html.includes('{{nonce}}'), 'nonce placeholder should be replaced');
  });

  test('createWebviewPanel reveals existing panel instead of creating a new one', () => {
    const vscode = require('vscode');
    let createCount = 0;
    const revealCalled = { value: false };
    vscode.window.createWebviewPanel = () => {
      createCount++;
      return createMockWebviewPanel(revealCalled);
    };

    const manager = new UIManager(createMockContext(extensionPath));
    manager.createWebviewPanel(); // first call - creates
    manager.createWebviewPanel(); // second call - should reveal

    assert.strictEqual(createCount, 1, 'panel should only be created once');
    assert.ok(revealCalled.value, 'reveal should be called on second invocation');
  });

  test('panel is set to null after dispose callback fires', () => {
    const vscode = require('vscode');
    const revealCalled = { value: false };
    vscode.window.createWebviewPanel = () => createMockWebviewPanel(revealCalled);

    const manager = new UIManager(createMockContext(extensionPath));
    manager.createWebviewPanel();

    assert.ok((manager as any).panel, 'panel should exist before dispose');

    // Simulate VS Code disposing the panel
    (manager as any).panel.dispose();

    assert.strictEqual((manager as any).panel, null, 'panel should be null after dispose callback');
  });

  test('message listener is wired up after createWebviewPanel', () => {
    const vscode = require('vscode');
    const revealCalled = { value: false };
    vscode.window.createWebviewPanel = () => createMockWebviewPanel(revealCalled);

    const manager = new UIManager(createMockContext(extensionPath));
    const received: WebviewMessage[] = [];
    manager.onMessage('sendRequest', (msg) => { received.push(msg); });

    manager.createWebviewPanel();

    // Simulate a message from the webview
    const panel = (manager as any).panel;
    for (const listener of panel._listeners) {
      listener({ type: 'sendRequest', payload: { url: 'https://test.com' } });
    }

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].type, 'sendRequest');
  });
});
