import React, { useState } from 'react';
import { CollectionTree } from '../sidebar/CollectionTree';
import { EnvironmentSelector } from '../sidebar/EnvironmentSelector';
import { HistoryView } from '../sidebar/HistoryView';
import { RequestEditor } from '../request/RequestEditor';
import { ResponseViewer } from '../response/ResponseViewer';
import { AuthEditor } from '../auth/AuthEditor';
import { ScriptEditor } from '../script/ScriptEditor';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import { Collection, Environment, HistoryEntry, HttpRequest, HttpResponse } from '../../types/api';
import { vscode } from '../../utils/vscode';
import './MainLayout.css';

interface MainLayoutProps {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history: HistoryEntry[];
  activeRequest: HttpRequest | null;
  activeResponse: HttpResponse | null;
  isLoading: boolean;
  error: string | null;
  activeTab: 'request' | 'collection' | 'environment' | 'history';
  sidebarWidth: number;
  onSendRequest: (request: HttpRequest) => void;
  onSaveRequest: (request: HttpRequest, collectionId: string, folderId?: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onSwitchEnvironment: (environmentId: string | null) => void;
  onUpdateVariable: (environmentId: string, variable: any) => void;
  onRunCollection: (collectionId: string, options?: any) => void;
  onClearHistory: () => void;
  onSelectRequest: (request: HttpRequest) => void;
  onTabChange: (tab: 'request' | 'collection' | 'environment' | 'history') => void;
  onSetActiveRequest: (request: HttpRequest | null) => void;
}

type SidebarTab = 'collections' | 'history' | 'environments';
type RequestTab = 'params' | 'headers' | 'body' | 'auth' | 'scripts';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  collections,
  environments,
  activeEnvironmentId,
  history,
  activeRequest,
  activeResponse,
  isLoading,
  error,
  activeTab,
  sidebarWidth,
  onSendRequest,
  onSaveRequest: _onSaveRequest,
  onDeleteRequest,
  onCreateCollection,
  onDeleteCollection,
  onSwitchEnvironment,
  onUpdateVariable: _onUpdateVariable,
  onRunCollection,
  onClearHistory,
  onSelectRequest,
  onTabChange: _onTabChange,
  onSetActiveRequest,
}) => {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('collections');
  const [requestTab, setRequestTab] = useState<RequestTab>('params');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNewRequest = () => {
    const newRequest: HttpRequest = {
      id: generateId(),
      name: '新建请求',
      method: 'GET',
      url: 'https://httpbin.org/get',
      headers: {},
      queryParams: {},
    };
    onSetActiveRequest(newRequest);
  };

  const handleImportCurl = () => {
    vscode.postMessage({ type: 'importCurl', payload: {} });
  };

  return (
    <div className="main-layout">
      <div
        className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
        style={{ width: isSidebarCollapsed ? 40 : sidebarWidth }}
      >
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${sidebarTab === 'collections' ? 'active' : ''}`}
            onClick={() => setSidebarTab('collections')}
            title="集合"
          >
            <i className="ri-folder-line" />
          </button>
          <button
            className={`sidebar-tab ${sidebarTab === 'history' ? 'active' : ''}`}
            onClick={() => setSidebarTab('history')}
            title="历史"
          >
            <i className="ri-history-line" />
          </button>
          <button
            className={`sidebar-tab ${sidebarTab === 'environments' ? 'active' : ''}`}
            onClick={() => setSidebarTab('environments')}
            title="环境"
          >
            <i className="ri-earth-line" />
          </button>
          <div className="sidebar-tab-spacer" />
          <button
            className="sidebar-tab"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? '展开' : '收起'}
          >
            <i className={`ri-side-bar-${isSidebarCollapsed ? 'right' : 'left'}-line`} />
          </button>
        </div>

        {!isSidebarCollapsed && (
          <div className="sidebar-content">
            {sidebarTab === 'collections' && (
              <CollectionTree
                collections={collections}
                onSelectRequest={onSelectRequest}
                onCreateCollection={onCreateCollection}
                onDeleteCollection={onDeleteCollection}
                onDeleteRequest={onDeleteRequest}
                onRunCollection={onRunCollection}
              />
            )}
            {sidebarTab === 'history' && (
              <HistoryView
                history={history}
                onSelectRequest={onSelectRequest}
                onClearHistory={onClearHistory}
              />
            )}
            {sidebarTab === 'environments' && (
              <EnvironmentSelector
                environments={environments}
                activeEnvironmentId={activeEnvironmentId}
                onSwitchEnvironment={onSwitchEnvironment}
                onUpdateVariable={_onUpdateVariable}
              />
            )}
          </div>
        )}
      </div>

      <div className="main-content">
        {activeTab === 'environment' ? (
          <EnvironmentManager
            environments={environments}
            activeEnvironmentId={activeEnvironmentId}
            onUpdateVariable={_onUpdateVariable}
            onSwitchEnvironment={onSwitchEnvironment}
          />
        ) : (
          <>
            <div className="request-section">
              {activeRequest ? (
                <>
                  <div className="request-tabs">
                    <button
                      className={`request-tab ${requestTab === 'params' ? 'active' : ''}`}
                      onClick={() => setRequestTab('params')}
                    >
                      参数
                    </button>
                    <button
                      className={`request-tab ${requestTab === 'headers' ? 'active' : ''}`}
                      onClick={() => setRequestTab('headers')}
                    >
                      请求头
                      {Object.keys(activeRequest.headers).length > 0 && (
                        <span className="tab-badge">
                          {Object.keys(activeRequest.headers).length}
                        </span>
                      )}
                    </button>
                    <button
                      className={`request-tab ${requestTab === 'body' ? 'active' : ''}`}
                      onClick={() => setRequestTab('body')}
                    >
                      请求体
                    </button>
                    <button
                      className={`request-tab ${requestTab === 'auth' ? 'active' : ''}`}
                      onClick={() => setRequestTab('auth')}
                    >
                      认证
                    </button>
                    <button
                      className={`request-tab ${requestTab === 'scripts' ? 'active' : ''}`}
                      onClick={() => setRequestTab('scripts')}
                    >
                      脚本
                    </button>
                  </div>

                  <div className="request-tab-content">
                    {requestTab === 'params' && (
                      <RequestEditor
                        request={activeRequest}
                        onRequestChange={onSetActiveRequest}
                        onSend={onSendRequest}
                        isLoading={isLoading}
                        activeTab="params"
                      />
                    )}
                    {requestTab === 'headers' && (
                      <RequestEditor
                        request={activeRequest}
                        onRequestChange={onSetActiveRequest}
                        onSend={onSendRequest}
                        isLoading={isLoading}
                        activeTab="headers"
                      />
                    )}
                    {requestTab === 'body' && (
                      <RequestEditor
                        request={activeRequest}
                        onRequestChange={onSetActiveRequest}
                        onSend={onSendRequest}
                        isLoading={isLoading}
                        activeTab="body"
                      />
                    )}
                    {requestTab === 'auth' && (
                      <AuthEditor
                        auth={activeRequest.auth}
                        onAuthChange={(auth) => onSetActiveRequest({ ...activeRequest, auth })}
                      />
                    )}
                    {requestTab === 'scripts' && (
                      <ScriptEditor
                        preRequestScript={activeRequest.preRequestScript}
                        postRequestScript={activeRequest.postRequestScript}
                        onPreRequestScriptChange={(script) =>
                          onSetActiveRequest({ ...activeRequest, preRequestScript: script })
                        }
                        onPostRequestScriptChange={(script) =>
                          onSetActiveRequest({ ...activeRequest, postRequestScript: script })
                        }
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <i className="ri-send-plane-line empty-icon" />
                  <h3 className="empty-title">开始使用 ApiMate</h3>
                  <p className="empty-desc">创建一个新请求或从集合中选择一个已有请求</p>
                  <div className="empty-actions">
                    <button className="action-button primary" onClick={handleNewRequest}>
                      <i className="ri-add-line" /> 新建请求
                    </button>
                    <button className="action-button" onClick={handleImportCurl}>
                      <i className="ri-terminal-line" /> 导入 cURL
                    </button>
                  </div>
                  <div className="empty-shortcuts">
                    <div className="shortcut-hint">
                      <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> 新建请求
                    </div>
                    <div className="shortcut-hint">
                      <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>S</kbd> 发送请求
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="response-section">
              {activeResponse ? (
                <ResponseViewer response={activeResponse} error={error} />
              ) : isLoading ? (
                <div className="loading-state">
                  <div className="loading-spinner" />
                  <p>正在发送请求...</p>
                </div>
              ) : (
                <div className="empty-state response-empty">
                  <i className="ri-inbox-line empty-icon" />
                  <p>响应将显示在这里</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
