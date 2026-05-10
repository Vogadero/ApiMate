import { useEffect, useState, useCallback, useRef } from 'react';
import { vscode } from './utils/vscode';
import {
  Collection,
  Environment,
  HistoryEntry,
  HttpRequest,
  HttpResponse,
  Variable,
  WebviewMessage,
  ExtensionMessage,
} from './types/api';
import { SidebarView } from './components/sidebar/SidebarView';
import { EditorView } from './components/editor/EditorView';

interface AppState {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  globalVariables: Variable[];
  history: HistoryEntry[];
  activeRequest: HttpRequest | null;
  activeResponse: HttpResponse | null;
  isLoading: boolean;
  error: string | null;
  mode: 'sidebar' | 'editor';
  collectionRunResult: any | null;
  showCurlDialog: boolean;
  showImportDialog: boolean;
  selectedFile: { index: number; filename: string; path: string } | null;
  maxParallel: number;
}

function getInitialMode(): 'sidebar' | 'editor' {
  try {
    const root = document.getElementById('root');
    const mode = root?.dataset.mode;
    if (mode === 'editor') return 'editor';
  } catch { /* ignore */ }
  return 'sidebar';
}

function getInitialRequest(): { request: HttpRequest | null; autoSend: boolean } {
  try {
    const root = document.getElementById('root');
    const data = root?.dataset.request;
    if (data) {
      const parsed = JSON.parse(data);
      return {
        request: parsed?.request ? (parsed.request as HttpRequest) : null,
        autoSend: !!parsed?.autoSend,
      };
    }
  } catch { /* ignore */ }
  return { request: null, autoSend: false };
}

const initialState: AppState = {
  collections: [],
  environments: [],
  activeEnvironmentId: null,
  globalVariables: [],
  history: [],
  activeRequest: getInitialRequest().request,
  activeResponse: null,
  isLoading: false,
  error: null,
  mode: getInitialMode(),
  collectionRunResult: null,
  showCurlDialog: false,
  showImportDialog: false,
  selectedFile: null,
  maxParallel: 5,
};

function postMessage(message: WebviewMessage): void {
  vscode.postMessage(message);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function showGlobalToast(msg: string) {
  const container = document.querySelector('.sidebar-view');
  if (!container) return;
  const existing = container.querySelector('.toast-msg');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.innerHTML = `<span class="toast-icon">✓</span><span class="toast-text">${msg}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add('toast-show');
  });
  setTimeout(() => {
    el.classList.remove('toast-show');
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    postMessage({ type: 'loadData', payload: {} });
  }, []);

  useEffect(() => {
    const { autoSend } = getInitialRequest();
    if (autoSend && state.activeRequest && state.mode === 'editor') {
      setState((prev) => ({ ...prev, isLoading: true }));
      postMessage({ type: 'sendRequest', payload: { request: state.activeRequest } });
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage;
      if (!message?.type) return;

      switch (message.type) {
        case 'dataLoaded': {
          const payload = message.payload ?? {};
          setState((prev) => ({
            ...prev,
            collections: payload.collections ?? prev.collections,
            environments: payload.environments ?? prev.environments,
            history: payload.history ?? prev.history,
            activeEnvironmentId: payload.activeEnvironmentId ?? prev.activeEnvironmentId,
            globalVariables: payload.globalVariables ?? prev.globalVariables,
            maxParallel: payload.maxParallel ?? prev.maxParallel,
          }));
          break;
        }
        case 'openEditor': {
          const request = message.payload?.request as HttpRequest | undefined;
          if (request) {
            setState((prev) => ({
              ...prev,
              mode: 'editor',
              activeRequest: request,
              activeResponse: null,
              isLoading: false,
              error: null,
            }));
          }
          break;
        }
        case 'requestComplete': {
          const payload = message.payload ?? {};
          if (payload.error) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: payload.error,
              activeResponse: {
                status: 0,
                statusText: 'Error',
                headers: {},
                body: payload.error,
                time: 0,
                size: 0,
                cookies: [],
              },
            }));
          } else if (payload.response) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              activeResponse: payload.response,
              error: null,
            }));
          }
          postMessage({ type: 'loadData', payload: {} });
          break;
        }
        case 'collectionRunResult': {
          const result = message.payload?.result;
          setState((prev) => ({
            ...prev,
            collectionRunResult: result,
          }));
          if (result) {
            const total = result.totalRequests || 0;
            const passed = result.passedTests || 0;
            const failed = result.failedTests || 0;
            const time = result.totalTime || 0;
            if (failed > 0) {
              showGlobalToast(`集合运行完成: ${total}个请求, ${passed}通过/${failed}失败, ${time}ms`);
            } else {
              showGlobalToast(`集合运行完成: ${total}个请求全部通过, ${time}ms`);
            }
          }
          break;
        }
        case 'sendRequest':
        case 'triggerSendRequest': {
          setState((prev) => ({ ...prev, isLoading: true, error: null }));
          break;
        }
        case 'showCurlImport': {
          setState((prev) => ({ ...prev, showCurlDialog: true }));
          break;
        }
        case 'showImportDialog': {
          setState((prev) => ({ ...prev, showImportDialog: true }));
          break;
        }
        case 'fileSelected': {
          setState((prev) => ({ ...prev, selectedFile: message.payload }));
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleNewRequest = useCallback(() => {
    const newRequest: HttpRequest = {
      id: generateId(),
      name: '新建请求',
      method: 'GET',
      url: 'https://httpbin.org/get',
      headers: { 'Accept': '*/*', 'User-Agent': 'ApiMate/1.0' },
      queryParams: {},
    };
    postMessage({ type: 'openEditor', payload: { request: newRequest } });
  }, []);

  const handleSelectRequest = useCallback((request: HttpRequest) => {
    postMessage({ type: 'openEditor', payload: { request } });
  }, []);

  const handleSendRequest = useCallback((request: HttpRequest) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    postMessage({ type: 'sendRequest', payload: { request } });
  }, []);

  const handleSaveRequest = useCallback((request: HttpRequest, collectionId: string, folderId?: string) => {
    postMessage({ type: 'saveRequest', payload: { request, collectionId, folderId: folderId ?? null } });
  }, []);

  const handleDeleteRequest = useCallback((requestId: string) => {
    postMessage({ type: 'deleteRequest', payload: { requestId } });
  }, []);

  const handleCreateCollection = useCallback((name: string) => {
    postMessage({ type: 'createCollection', payload: { name } });
  }, []);

  const handleDeleteCollection = useCallback((collectionId: string) => {
    postMessage({ type: 'deleteCollection', payload: { collectionId } });
  }, []);

  const handleSwitchEnvironment = useCallback((environmentId: string | null) => {
    postMessage({ type: 'switchEnvironment', payload: { environmentId } });
  }, []);

  const handleUpdateVariable = useCallback((environmentId: string, variable: any) => {
    postMessage({ type: 'updateVariable', payload: { environmentId, variable } });
  }, []);

  const handleRunCollection = useCallback((collectionId: string, options?: any) => {
    postMessage({ type: 'runCollection', payload: { collectionId, ...options } });
  }, []);

  const handleClearHistory = useCallback(() => {
    postMessage({ type: 'clearHistory', payload: {} });
  }, []);

  const handleSetActiveRequest = useCallback((request: HttpRequest | null) => {
    setState((prev) => ({
      ...prev,
      activeRequest: request,
    }));
  }, []);

  const handleImportCurl = useCallback(() => {
    postMessage({ type: 'importCurl', payload: {} });
  }, []);

  const handleImportCollection = useCallback((format?: string) => {
    postMessage({ type: 'importCollection', payload: { format: format || 'postman' } });
  }, []);

  if (state.mode === 'editor') {
    if (state.activeRequest) {
      return (
        <EditorView
          request={state.activeRequest}
          response={state.activeResponse}
          isLoading={state.isLoading}
          error={state.error}
          collections={state.collections}
          environments={state.environments}
          activeEnvironmentId={state.activeEnvironmentId}
          selectedFile={state.selectedFile}
          onSendRequest={handleSendRequest}
          onSaveRequest={handleSaveRequest}
          onRequestChange={handleSetActiveRequest}
          onSwitchEnvironment={handleSwitchEnvironment}
          onSelectedFileConsumed={() => setState((prev) => ({ ...prev, selectedFile: null }))}
        />
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--vscode-descriptionForeground)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <SidebarView
      collections={state.collections}
      environments={state.environments}
      activeEnvironmentId={state.activeEnvironmentId}
      globalVariables={state.globalVariables}
      history={state.history}
      showCurlDialog={state.showCurlDialog}
      showImportDialog={state.showImportDialog}
      configMaxParallel={state.maxParallel}
      onCurlDialogClose={() => setState((prev) => ({ ...prev, showCurlDialog: false }))}
      onImportDialogClose={() => setState((prev) => ({ ...prev, showImportDialog: false }))}
      onImportDialogOpen={() => setState((prev) => ({ ...prev, showImportDialog: true }))}
      onNewRequest={handleNewRequest}
      onSelectRequest={handleSelectRequest}
      onCreateCollection={handleCreateCollection}
      onDeleteCollection={handleDeleteCollection}
      onDeleteRequest={handleDeleteRequest}
      onSwitchEnvironment={handleSwitchEnvironment}
      onUpdateVariable={handleUpdateVariable}
      onRunCollection={handleRunCollection}
      onClearHistory={handleClearHistory}
      onImportCurl={handleImportCurl}
      onImportCollection={handleImportCollection}
    />
  );
}
