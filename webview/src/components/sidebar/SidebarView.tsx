import React, { useState, useEffect, useRef } from 'react';
import {
  Collection,
  Environment,
  HistoryEntry,
  HttpRequest,
  HttpMethod,
  METHOD_RAW_COLORS,
  Variable,
} from '../../types/api';
import { Icon } from '../common/Icon';
import { vscode } from '../../utils/vscode';
import './SidebarView.css';

interface SidebarViewProps {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  globalVariables: Variable[];
  history: HistoryEntry[];
  showCurlDialog: boolean;
  onCurlDialogClose: () => void;
  showImportDialog: boolean;
  onImportDialogClose: () => void;
  onImportDialogOpen: () => void;
  onNewRequest: () => void;
  onSelectRequest: (request: HttpRequest) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onSwitchEnvironment: (environmentId: string | null) => void;
  onUpdateVariable: (environmentId: string, variable: any) => void;
  onRunCollection: (collectionId: string, options?: { maxParallel?: number }) => void;
  onClearHistory: () => void;
  onImportCurl?: () => void;
  onImportCollection: (format?: string) => void;
  configMaxParallel?: number;
}

type Tab = 'history' | 'collections' | 'environments';

function showToast(msg: string) {
  const existing = document.getElementById('apimate-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'apimate-toast';
  el.className = 'toast-msg';
  el.innerHTML = `<span class="toast-icon">✓</span><span class="toast-text">${msg}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add('toast-show');
  });
  setTimeout(() => {
    el.classList.remove('toast-show');
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 300);
  }, 1500);
}

export const SidebarView: React.FC<SidebarViewProps> = ({
  collections,
  environments,
  activeEnvironmentId,
  globalVariables,
  history,
  showCurlDialog: externalShowCurlDialog,
  showImportDialog,
  onCurlDialogClose,
  onImportDialogClose,
  onImportDialogOpen,
  onNewRequest,
  onSelectRequest,
  onCreateCollection,
  onDeleteCollection,
  onDeleteRequest,
  onSwitchEnvironment,
  onUpdateVariable,
  onRunCollection,
  onClearHistory,
  onImportCurl: _onImportCurl,
  onImportCollection,
  configMaxParallel,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingEnv, setIsCreatingEnv] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEnvName, setNewEnvName] = useState('');
  const [showCurlDialog, setShowCurlDialog] = useState(false);
  const [curlRaw, setCurlRaw] = useState(false);
  const [curlText, setCurlText] = useState('');

  useEffect(() => {
    if (externalShowCurlDialog) {
      setShowCurlDialog(true);
      onCurlDialogClose();
    }
  }, [externalShowCurlDialog, onCurlDialogClose]);
  const [filterText, setFilterText] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: any;
    targetId: string;
    type: 'history' | 'collection' | 'request' | 'folder' | 'environment';
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [selectedRequestKey, setSelectedRequestKey] = useState<string | null>(null);
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [showAddToCollection, setShowAddToCollection] = useState<{
    entry: HistoryEntry;
    x: number;
    y: number;
  } | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState<string | null>(null);
  const [isCreatingSubFolder, setIsCreatingSubFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenamingCollection, setIsRenamingCollection] = useState<string | null>(null);
  const [renameCollectionValue, setRenameCollectionValue] = useState('');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newGlobalVarKey, setNewGlobalVarKey] = useState('');
  const [newGlobalVarValue, setNewGlobalVarValue] = useState('');
  const [isRenamingEnv, setIsRenamingEnv] = useState<string | null>(null);
  const [renameEnvValue, setRenameEnvValue] = useState('');
  const [selectedEnvItemId, setSelectedEnvItemId] = useState<string | null>(null);
  const [importFormat, setImportFormat] = useState<'postman' | 'openapi' | 'curl'>('postman');
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [maxParallel, setMaxParallel] = useState(configMaxParallel ?? 5);
  const [showRunSettings, setShowRunSettings] = useState(false);
  const [openMoreMenu, setOpenMoreMenu] = useState<string | null>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const runSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (configMaxParallel !== undefined && configMaxParallel !== maxParallel) {
      setMaxParallel(configMaxParallel);
    }
  }, [configMaxParallel]);

  useEffect(() => {
    if (!showRunSettings) return;
    const handler = (e: MouseEvent) => {
      if (runSettingsRef.current && !runSettingsRef.current.contains(e.target as Node)) {
        setShowRunSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRunSettings]);

  function getStatusDotColor(status: number): string {
    const first = String(status).charAt(0);
    if (first === '2') return '#4ec9b0';
    if (first === '3') return '#dcdcaa';
    if (first === '4') return '#f14c4c';
    if (first === '5') return '#f14c4c';
    return '#666';
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'requestComplete') {
        setResendingIds(new Set());
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const timer1 = setTimeout(() => setLoadingProgress(40), 30);
    const timer2 = setTimeout(() => setLoadingProgress(75), 100);
    const timer3 = setTimeout(() => {
      setLoadingProgress(100);
      setTimeout(() => setLoading(false), 150);
    }, 250);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const toggleExpand = (id: string) => {
    const n = new Set(expandedIds);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpandedIds(n);
  };

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateCollection(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleCreateEnv = () => {
    if (newEnvName.trim()) {
      vscode.postMessage({ type: 'createEnvironment', payload: { name: newEnvName.trim() } });
      setNewEnvName('');
      setIsCreatingEnv(false);
      showToast(`已创建环境: ${newEnvName}`);
    }
  };

  const [_showEnvDropdown, _setShowEnvDropdown] = useState(false);

  useEffect(() => {
    if (!contextMenu) setShowAddToCollection(null);
  }, [contextMenu]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowAddToCollection(null);
      }
      if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node))
        _setShowEnvDropdown(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node))
        setOpenMoreMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuRef]);

  const filteredCollections = filterText
    ? collections.filter(
        (c) =>
          (c?.name || '').toLowerCase().includes((filterText || '').toLowerCase()) ||
          (c?.requests || []).some(
            (r) =>
              (r?.name || '').toLowerCase().includes((filterText || '').toLowerCase()) ||
              (r?.url || '').toLowerCase().includes((filterText || '').toLowerCase())
          )
      )
    : collections;

  const filteredHistory = filterText
    ? history.filter(
        (h) =>
          (h?.request?.url || '').toLowerCase().includes((filterText || '').toLowerCase()) ||
          (h?.request?.name || '').toLowerCase().includes((filterText || '').toLowerCase()) ||
          (h?.name || '').toLowerCase().includes((filterText || '').toLowerCase())
      )
    : history;

  const filteredEnvironments = filterText
    ? environments.filter((e) =>
        (e?.name || '').toLowerCase().includes((filterText || '').toLowerCase())
      )
    : environments;

  const handleContextMenu = (
    e: React.MouseEvent,
    target: any,
    type: 'history' | 'collection' | 'request' | 'folder' | 'environment'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const targetId = target?.id ?? target?.request?.id ?? '';
    setContextMenu({ x: e.clientX, y: e.clientY, target, targetId, type });
    setShowAddToCollection(null);
  };

  const findCollectionIdByFolderId = (folderId: string): string | null => {
    const searchInFolders = (folders: any[]): boolean => {
      for (const f of folders) {
        if (f.id === folderId) return true;
        if (f.folders && f.folders.length > 0 && searchInFolders(f.folders)) return true;
      }
      return false;
    };
    for (const c of collections) {
      if (searchInFolders(c.folders)) return c.id;
    }
    return null;
  };

  const getFolderDepth = (folderId: string): number => {
    for (const c of collections) {
      const search = (folders: any[], depth: number): number => {
        for (const f of folders) {
          if (f.id === folderId) return depth;
          if (f.folders && f.folders.length > 0) {
            const found = search(f.folders, depth + 1);
            if (found >= 0) return found;
          }
        }
        return -1;
      };
      const depth = search(c.folders, 1);
      if (depth >= 0) return depth;
    }
    return 0;
  };

  const findParentFolderId = (folderId: string): string | null => {
    const search = (folders: any[]): string | null => {
      for (const f of folders) {
        if (f.folders) {
          for (const sf of f.folders) {
            if (sf.id === folderId) return f.id;
          }
          const nested = search(f.folders);
          if (nested) return nested;
        }
      }
      return null;
    };
    for (const c of collections) {
      const result = search(c.folders);
      if (result) return result;
    }
    return null;
  };

  const getDisplayName = (req: any): string => {
    if ((!req.name || req.name === '新建请求') && req.url) return req.url;
    return req.name || req.url || '';
  };

  const handleRenameHistory = () => {
    if (!contextMenu || contextMenu.type !== 'history') return;
    const targetId = contextMenu.targetId;
    const targetName =
      contextMenu.target.name ||
      contextMenu.target.request?.name ||
      contextMenu.target.request?.url ||
      '';
    setPendingRenameId(targetId);
    setPendingRenameValue(targetName);
    setContextMenu(null);
  };

  const handleRenameConfirm = () => {
    if (renamingId && renameValue.trim()) {
      vscode.postMessage({
        type: 'renameHistoryEntry',
        payload: { id: renamingId, name: renameValue.trim() },
      });
      showToast('已重命名');
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDeleteHistory = () => {
    if (!contextMenu || contextMenu.type !== 'history') return;
    vscode.postMessage({ type: 'deleteHistoryEntry', payload: { id: contextMenu.targetId } });
    showToast('已删除');
    setContextMenu(null);
  };

  const getNextCopyName = (baseName: string, existingNames: string[]): string => {
    const copyBase = baseName + ' (Copy)';
    if (!existingNames.includes(copyBase)) return copyBase;
    let n = 2;
    while (existingNames.includes(`${baseName} (Copy${n})`)) n++;
    return `${baseName} (Copy${n})`;
  };

  const handleCopyRequest = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'history') {
      const displayName =
        (!contextMenu.target.request.name || contextMenu.target.request.name === '新建请求') &&
        contextMenu.target.request.url
          ? contextMenu.target.request.url
          : contextMenu.target.request.name || contextMenu.target.request.url || '';
      const existingNames = history.map((e) => e.name || e.request?.name || '');
      const copyName = getNextCopyName(displayName, existingNames);
      const req = {
        ...contextMenu.target.request,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: copyName,
      };
      vscode.postMessage({ type: 'copyHistoryEntry', payload: { request: req } });
      showToast('已复制请求');
    } else if (contextMenu.type === 'request') {
      vscode.postMessage({
        type: 'duplicateRequest',
        payload: { requestId: contextMenu.targetId },
      });
      showToast('已复制请求');
    } else if (contextMenu.type === 'collection') {
      vscode.postMessage({
        type: 'duplicateCollection',
        payload: { collectionId: contextMenu.targetId },
      });
      showToast('已复制集合');
    }
    setContextMenu(null);
  };

  const handleResend = () => {
    if (!contextMenu || contextMenu.type !== 'history') return;
    setResendingIds((prev) => new Set(prev).add(contextMenu.targetId));
    vscode.postMessage({
      type: 'sendRequest',
      payload: { request: contextMenu.target.request, historyEntryId: contextMenu.targetId },
    });
    vscode.postMessage({
      type: 'openEditor',
      payload: { request: contextMenu.target.request, autoSend: true },
    });
    showToast('正在重发请求...');
    setContextMenu(null);
  };

  const handlePin = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'request') {
      vscode.postMessage({ type: 'pinRequest', payload: { requestId: contextMenu.targetId } });
    } else {
      vscode.postMessage({ type: 'pinHistoryEntry', payload: { id: contextMenu.targetId } });
    }
    showToast(contextMenu.target.pinned ? '已取消置顶' : '已置顶');
    setContextMenu(null);
  };

  const handleAddToCollection = (entry: HistoryEntry, collectionId: string, folderId?: string) => {
    const effectiveName =
      (!entry.name || entry.name === '新建请求') && entry.request?.url
        ? entry.request.url
        : entry.name || entry.request?.url || '';
    const requestWithName = {
      ...entry.request,
      name: effectiveName,
    };

    const collection = collections.find((c) => c.id === collectionId);
    if (collection) {
      const existingReqs = folderId
        ? (collection.folders.find((f) => f.id === folderId)?.requests ?? [])
        : collection.requests;
      const dup = existingReqs.some(
        (r) => r.url === requestWithName.url && r.method === requestWithName.method && r.url !== ''
      );
      if (dup) {
        showToast(folderId ? '该请求已存在于文件夹中' : '该请求已存在于集合中');
        setContextMenu(null);
        setShowAddToCollection(null);
        return;
      }
    }

    vscode.postMessage({
      type: 'saveRequest',
      payload: { request: requestWithName, collectionId, folderId: folderId ?? null },
    });
    showToast(folderId ? '已添加到文件夹' : '已添加到集合');
    setContextMenu(null);
    setShowAddToCollection(null);
  };

  const handleExportCollection = (collection: Collection) => {
    const data = JSON.stringify(collection, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出集合');
  };

  const handleExportEnvironment = (env: Environment) => {
    const data = JSON.stringify(env, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${env.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出环境');
  };

  const handleImportEnvironment = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const env = JSON.parse(ev.target?.result as string);
          vscode.postMessage({ type: 'importEnvironment', payload: { environment: env } });
          showToast('已导入环境');
        } catch {
          showToast('导入失败: 无效的 JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleRenameCollection = (collectionId: string) => {
    const c = collections.find((col) => col.id === collectionId);
    if (!c) return;
    setIsRenamingCollection(collectionId);
    setRenameCollectionValue(c.name);
  };

  const handleRenameCollectionConfirm = () => {
    if (isRenamingCollection && renameCollectionValue.trim()) {
      vscode.postMessage({
        type: 'renameCollection',
        payload: { collectionId: isRenamingCollection, name: renameCollectionValue.trim() },
      });
      showToast('已重命名集合');
    }
    setIsRenamingCollection(null);
    setRenameCollectionValue('');
  };

  const handleNewFolder = (collectionId: string) => {
    setIsCreatingFolder(collectionId);
    setNewFolderName('');
  };

  const handleCreateFolder = () => {
    if (isCreatingFolder && newFolderName.trim()) {
      vscode.postMessage({
        type: 'addFolder',
        payload: { collectionId: isCreatingFolder, name: newFolderName.trim() },
      });
      showToast('已创建文件夹');
    }
    setIsCreatingFolder(null);
    setNewFolderName('');
  };

  const handleCreateSubFolder = () => {
    if (isCreatingSubFolder && newFolderName.trim()) {
      const colId = findCollectionIdByFolderId(isCreatingSubFolder);
      if (colId) {
        vscode.postMessage({
          type: 'addFolder',
          payload: { collectionId: colId, parentFolderId: isCreatingSubFolder, name: newFolderName.trim() },
        });
        showToast('已创建文件夹');
      }
    }
    setIsCreatingSubFolder(null);
    setNewFolderName('');
  };

  const handleNewRequestInCollection = (collectionId: string, folderId?: string) => {
    const newReq: HttpRequest = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: '新建请求',
      method: 'GET',
      url: 'https://httpbin.org/get',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer <token>',
      },
      queryParams: { page: '1', limit: '10' },
    };
    vscode.postMessage({
      type: 'saveRequest',
      payload: { request: newReq, collectionId, folderId: folderId ?? null },
    });
    onSelectRequest(newReq);
    showToast('已在集合中新建请求');
  };

  const renderSubFolder = (subFolder: any, depth: number) => {
    const indent = 20 + depth * 16;
    return (
      <div key={subFolder.id} className="tree-node">
        <div
          className="tree-row folder-row"
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => toggleExpand(subFolder.id)}
          onContextMenu={(e) => handleContextMenu(e, subFolder, 'folder')}
          title={`文件夹: ${subFolder.name}`}
        >
          <Icon
            name={expandedIds.has(subFolder.id) ? 'arrow-down' : 'arrow-right'}
            size={13}
            color="var(--text-muted)"
          />
          <Icon
            name={expandedIds.has(subFolder.id) ? 'folder-open' : 'folder-close'}
            size={16}
            color="#6a9fd8"
          />
          {renamingFolderId === subFolder.id ? (
            <input
              className="rename-input"
              type="text"
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolderConfirm(subFolder.id);
                if (e.key === 'Escape') setRenamingFolderId(null);
              }}
              onBlur={() => handleRenameFolderConfirm(subFolder.id)}
              autoFocus
              spellCheck={false}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-label">{subFolder.name}</span>
          )}
          <div className="tree-hover-actions">
            <button
              className={`icon-btn xs more-btn ${openMoreMenu === subFolder.id ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (openMoreMenu === subFolder.id) {
                  setOpenMoreMenu(null);
                } else {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMoreMenuPos({ top: rect.bottom + 2, left: rect.left - 120 });
                  setOpenMoreMenu(subFolder.id);
                }
              }}
              title="更多操作 / More"
            >
              <Icon name="more" size={13} />
            </button>
            {openMoreMenu === subFolder.id && (
              <div className="more-dropdown animate-scale-in" ref={moreMenuRef} style={{ top: moreMenuPos.top, left: moreMenuPos.left }} onClick={(e) => e.stopPropagation()}>
                <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); setRenamingFolderId(subFolder.id); setRenameFolderValue(subFolder.name); setOpenMoreMenu(null); }}>
                  <Icon name="edit" size={13} /> 重命名
                </button>
                <button className="context-menu-item" onClick={(e) => {
                  e.stopPropagation();
                  const colId = findCollectionIdByFolderId(subFolder.id);
                  if (colId) {
                    const parentFolderId = findParentFolderId(subFolder.id);
                    const col = collections.find((c) => c.id === colId);
                    let siblingNames: string[] = [];
                    if (parentFolderId) {
                      const findFolder = (folders: any[]): any => {
                        for (const f of folders) {
                          if (f.id === parentFolderId) return f;
                          if (f.folders) { const found = findFolder(f.folders); if (found) return found; }
                        }
                        return null;
                      };
                      const parent = findFolder(col!.folders);
                      siblingNames = parent ? parent.folders.map((f: any) => f.name) : [];
                    } else {
                      siblingNames = col ? col.folders.map((f: any) => f.name) : [];
                    }
                    const copyName = getNextCopyName(subFolder.name, siblingNames);
                    vscode.postMessage({ type: 'addFolder', payload: { collectionId: colId, parentFolderId: parentFolderId, name: copyName } });
                    showToast('已复制文件夹');
                  }
                  setOpenMoreMenu(null);
                }}>
                  <Icon name="copy" size={13} /> 复制文件夹
                </button>
                <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleNewRequestInCollection(findCollectionIdByFolderId(subFolder.id) || '', subFolder.id); setOpenMoreMenu(null); }}>
                  <Icon name="send" size={13} /> 新建请求
                </button>
                {getFolderDepth(subFolder.id) < 2 && (
                  <button className="context-menu-item" onClick={(e) => {
                    e.stopPropagation();
                    const colId = findCollectionIdByFolderId(subFolder.id);
                    if (colId) {
                      vscode.postMessage({ type: 'addFolder', payload: { collectionId: colId, parentFolderId: subFolder.id, name: '新建文件夹' } });
                      showToast('已新建文件夹');
                    }
                    setOpenMoreMenu(null);
                  }}>
                    <Icon name="plus" size={13} /> 新建文件夹
                  </button>
                )}
                <div className="dropdown-divider" />
                <button className="context-menu-item" onClick={(e) => {
                  e.stopPropagation();
                  const requests = subFolder.requests || [];
                  if (requests.length === 0) { showToast('文件夹中没有请求'); setOpenMoreMenu(null); return; }
                  requests.forEach((req: HttpRequest) => { vscode.postMessage({ type: 'sendRequest', payload: { request: req } }); });
                  showToast(`正在运行文件夹中的 ${requests.length} 个请求...`);
                  setOpenMoreMenu(null);
                }}>
                  <Icon name="play" size={13} /> 运行
                </button>
                <button className="context-menu-item" onClick={(e) => {
                  e.stopPropagation();
                  const folderData = JSON.stringify(subFolder, null, 2);
                  const blob = new Blob([folderData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${subFolder.name || 'folder'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('已导出文件夹');
                  setOpenMoreMenu(null);
                }}>
                  <Icon name="upload" size={13} /> 导出
                </button>
                <div className="dropdown-divider" />
                <button className="context-menu-item danger" onClick={(e) => { e.stopPropagation(); vscode.postMessage({ type: 'deleteFolder', payload: { folderId: subFolder.id } }); showToast('已删除文件夹'); setOpenMoreMenu(null); }}>
                  <Icon name="delete-bin" size={13} /> 删除
                </button>
              </div>
            )}
          </div>
        </div>
        {expandedIds.has(subFolder.id) && (
          <div className={`tree-children has-parent tree-children-depth-${depth} animate-fade-in`}>
            {subFolder.folders && subFolder.folders.map((sf: any) => renderSubFolder(sf, depth + 1))}
            {[...subFolder.requests]
              .sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
              .map((req: any) => (
                <div
                  key={req.id}
                  className={`history-item tree-depth-2 ${req.pinned ? 'pinned' : ''} ${selectedRequestKey === `${subFolder.id}::${req.id}` ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectRequest(req);
                    setSelectedRequestKey(`${subFolder.id}::${req.id}`);
                    setSelectedHistoryId(null);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, req, 'request')}
                  title={`${req.method} ${getDisplayName(req)}`}
                >
                  <div className="history-item-top">
                    {req.pinned && (
                      <span className="pin-indicator" title="已置顶 / Pinned">
                        <Icon name="to-top" size={12} color="var(--accent)" />
                      </span>
                    )}
                    <span
                      className="method-tag-pill"
                      style={{
                        backgroundColor: (METHOD_RAW_COLORS[req.method as HttpMethod] || '#9cdcfe') + '22',
                        color: METHOD_RAW_COLORS[req.method as HttpMethod] || '#9cdcfe',
                      }}
                    >
                      {req.method}
                    </span>
                    {renamingId === req.id ? (
                      <input
                        className="rename-input"
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameRequestConfirm(req.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => handleRenameRequestConfirm(req.id)}
                        autoFocus
                        spellCheck={false}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="history-url">
                        {getDisplayName(req)}
                      </span>
                    )}
                    <div className="tree-hover-actions">
                      <button
                        className="icon-btn xs danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (req.id) {
                            vscode.postMessage({ type: 'deleteRequest', payload: { requestId: req.id } });
                            showToast('已删除请求');
                          }
                          setContextMenu(null);
                        }}
                        title="删除 / Delete"
                      >
                        <Icon name="delete-bin" size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="history-item-time">
                    {req.name && req.url && req.name !== req.url && req.name !== '新建请求' ? req.url : ''}
                    {req.createdAt
                      ? (req.name && req.url && req.name !== req.url && req.name !== '新建请求' ? ' · ' : '') +
                        new Date(req.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [pendingRenameValue, setPendingRenameValue] = useState('');

  useEffect(() => {
    if (pendingRenameId && !contextMenu) {
      setRenamingId(pendingRenameId);
      setRenameValue(pendingRenameValue);
      setPendingRenameId(null);
      setPendingRenameValue('');
    }
  }, [pendingRenameId, pendingRenameValue, contextMenu]);

  const handleRenameRequest = (requestId: string) => {
    const req = collections
      .flatMap((c) => [...c.requests, ...c.folders.flatMap((f) => f.requests)])
      .find((r) => r.id === requestId);
    setPendingRenameId(requestId);
    setPendingRenameValue(req?.name || req?.url || '');
    setContextMenu(null);
  };

  const handleRenameRequestConfirm = (requestId: string) => {
    if (renameValue.trim()) {
      vscode.postMessage({
        type: 'renameRequest',
        payload: { requestId, name: renameValue.trim() },
      });
      showToast('已重命名');
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameFolder = (folderId: string) => {
    const folder = collections.flatMap((c) => c.folders).find((f) => f.id === folderId);
    setRenamingFolderId(folderId);
    setRenameFolderValue(folder?.name || '');
    setContextMenu(null);
  };

  const handleRenameFolderConfirm = (folderId: string) => {
    if (renameFolderValue.trim()) {
      vscode.postMessage({
        type: 'renameFolder',
        payload: { folderId, name: renameFolderValue.trim() },
      });
      showToast('已重命名文件夹');
    }
    setRenamingFolderId(null);
    setRenameFolderValue('');
  };

  const handleDeleteEnv = (envId: string) => {
    vscode.postMessage({ type: 'deleteEnvironment', payload: { environmentId: envId } });
    showToast('已删除环境');
  };

  const handleAddEnvVar = (envId: string) => {
    if (!newVarKey.trim()) return;
    vscode.postMessage({
      type: 'addEnvironmentVariable',
      payload: { environmentId: envId, key: newVarKey.trim(), value: newVarValue },
    });
    setNewVarKey('');
    setNewVarValue('');
  };

  const handleDeleteEnvVar = (envId: string, key: string) => {
    vscode.postMessage({
      type: 'deleteEnvironmentVariable',
      payload: { environmentId: envId, key },
    });
    showToast('已删除变量');
  };

  const handleDuplicateEnv = (envId: string) => {
    vscode.postMessage({ type: 'duplicateEnvironment', payload: { environmentId: envId } });
    showToast('已复制环境');
  };

  const handleRenameEnv = (envId: string) => {
    const env = environments.find((e) => e.id === envId);
    if (!env) return;
    setIsRenamingEnv(envId);
    setRenameEnvValue(env.name);
  };

  const handleRenameEnvConfirm = () => {
    if (isRenamingEnv && renameEnvValue.trim()) {
      vscode.postMessage({
        type: 'renameEnvironment',
        payload: { environmentId: isRenamingEnv, name: renameEnvValue.trim() },
      });
      showToast('已重命名环境');
    }
    setIsRenamingEnv(null);
    setRenameEnvValue('');
  };

  const handleAddGlobalVar = () => {
    if (!newGlobalVarKey.trim()) return;
    vscode.postMessage({
      type: 'updateGlobalVariable',
      payload: { variable: { key: newGlobalVarKey.trim(), value: newGlobalVarValue, type: 'default' as const, enabled: true } },
    });
    setNewGlobalVarKey('');
    setNewGlobalVarValue('');
  };

  const handleDeleteGlobalVar = (key: string) => {
    vscode.postMessage({ type: 'deleteGlobalVariable', payload: { key } });
    showToast('已删除全局变量');
  };

  const handleUpdateGlobalVar = (variable: any) => {
    vscode.postMessage({ type: 'updateGlobalVariable', payload: { variable } });
  };

  const handleImportEnvFile = (environmentId?: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.env,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        vscode.postMessage({
          type: 'importEnvFile',
          payload: { content, environmentId: environmentId || null, name: file.name.replace(/\.(env|txt)$/, '') },
        });
        showToast('已导入 .env 文件');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="sidebar-view">
      {loading && <div className="nprogress-bar" style={{ width: `${loadingProgress}%` }} />}
      <div
        className={`sidebar-content ${loading ? 'loading' : ''}`}
        onClick={() => {
          setIsCreating(false);
          setIsCreatingEnv(false);
          setIsCreatingFolder(null);
          setNewFolderName('');
        }}
      >
        <div className="sidebar-new-request">
          <button className="btn-primary full" onClick={onNewRequest}>
            <Icon name="send" size={16} />
            <span>新建请求</span>
          </button>
        </div>

        <div className="sidebar-tabs">
          {(['history', 'collections', 'environments'] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`sidebar-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab);
                setFilterText('');
              }}
              title={
                {
                  history: '历史 / History',
                  collections: '集合 / Collections',
                  environments: '环境 / Environments',
                }[tab]
              }
            >
              <Icon
                name={{ history: 'history', collections: 'collection', environments: 'earth' }[tab]}
                size={15}
              />
              <span>{{ history: '历史', collections: '集合', environments: '环境' }[tab]}</span>
              {tab === 'history' && history.length > 0 && (
                <span className="tab-badge">{history.length}</span>
              )}
              {tab === 'collections' && collections.length > 0 && (
                <span className="tab-badge">{collections.length}</span>
              )}
              {tab === 'environments' && environments.length > 0 && (
                <span className="tab-badge">{environments.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-filter">
          <div className="filter-input-wrapper">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={
                { history: '搜索历史...', collections: '搜索集合...', environments: '搜索环境...' }[
                  activeTab
                ]
              }
              spellCheck={false}
            />
            <Icon name="search" size={14} color="var(--text-muted)" className="filter-icon" />
            {filterText && (
              <button className="filter-clear" onClick={() => setFilterText('')}>
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-body">
          {activeTab === 'history' && (
            <div className="tab-content animate-fade-in">
              <div className="section-toolbar">
                <span className="section-label">请求历史</span>
                <div className="section-actions">
                  <button
                    className="icon-btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCurlDialog(true);
                    }}
                    title="导入 cURL / Import cURL"
                  >
                    <Icon name="link" size={14} />
                  </button>
                  {history.length > 0 && (
                    <button
                      className="icon-btn sm danger"
                      onClick={onClearHistory}
                      title="清空 / Clear"
                    >
                      <Icon name="delete-bin" size={14} />
                    </button>
                  )}
                </div>
              </div>
              {filteredHistory.length > 0 &&
                filteredHistory
                  .filter((entry) => entry?.request)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className={`history-item ${entry.pinned ? 'pinned' : ''} ${selectedHistoryId === entry.id ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectRequest(entry.request);
                        setSelectedHistoryId(entry.id);
                        setSelectedRequestKey(null);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, entry, 'history')}
                      title={`${entry.request?.method || ''} ${entry.request?.url || ''}`}
                    >
                      {renamingId === entry.id ? (
                        <input
                          className="rename-input"
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameConfirm();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onBlur={handleRenameConfirm}
                          autoFocus
                          spellCheck={false}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className="history-item-top">
                            {entry.pinned && (
                              <span className="pin-indicator" title="已置顶 / Pinned">
                                <Icon name="to-top" size={12} color="var(--accent)" />
                              </span>
                            )}
                            <span
                              className="method-tag-pill"
                              style={{
                                backgroundColor:
                                  (METHOD_RAW_COLORS[entry.request?.method as HttpMethod] ||
                                    '#9cdcfe') + '22',
                                color:
                                  METHOD_RAW_COLORS[entry.request?.method as HttpMethod] ||
                                  '#9cdcfe',
                              }}
                            >
                              {entry.request?.method || 'GET'}
                            </span>
                            <span className="history-url">
                              {(!entry.name || entry.name === '新建请求') && entry.request?.url
                                ? entry.request.url
                                : entry.name || entry.request?.url || ''}
                            </span>
                            <span
                              className={`status-dot ${resendingIds.has(entry.id) ? 'status-loading' : ''}`}
                              style={{
                                backgroundColor: resendingIds.has(entry.id)
                                  ? undefined
                                  : getStatusDotColor(entry.response?.status ?? 0),
                              }}
                            />
                          </div>
                          {entry.timestamp > 0 && (
                            <div className="history-item-time">
                              {new Date(entry.timestamp).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
              {filteredHistory.length === 0 && (
                <div className="empty-state animate-fade-in">
                  <Icon name="history" size={44} color="var(--text-muted)" />
                  <p className="empty-title">{filterText ? '无匹配结果' : '暂无历史'}</p>
                  <p className="empty-desc">
                    {filterText ? '尝试其他搜索关键词' : '发送请求后，记录将显示在这里'}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="tab-content animate-fade-in">
              <div className="section-toolbar">
                <span className="section-label">集合列表</span>
                <div className="section-actions">
                  <button
                    className="icon-btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreating(true);
                    }}
                    title="新建集合 / New Collection"
                  >
                    <Icon name="folder-focus" size={14} />
                  </button>
                  <button
                    className="icon-btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onImportDialogOpen();
                    }}
                    title="导入集合 / Import"
                  >
                    <Icon name="download" size={14} />
                  </button>
                  <button
                    className="icon-btn sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRunSettings(!showRunSettings);
                    }}
                    title="运行设置 / Run Settings"
                  >
                    <Icon name="setting" size={14} />
                  </button>
                </div>
              </div>
              {showRunSettings && (
                <div
                  className="create-form animate-scale-in"
                  ref={runSettingsRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                    >
                      最大并发数
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={maxParallel}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1) setMaxParallel(v);
                      }}
                      style={{
                        width: 60,
                        fontSize: 12,
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      （默认5，最小1）
                    </span>
                  </div>
                </div>
              )}
              {isCreating && (
                <div className="create-form animate-scale-in" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setIsCreating(false);
                    }}
                    placeholder="输入集合名称"
                    autoFocus
                    spellCheck={false}
                  />
                  <button className="icon-btn sm confirm" onClick={handleCreate}>
                    <Icon name="check" size={16} />
                  </button>
                  <button className="icon-btn sm danger" onClick={() => setIsCreating(false)}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
              {filteredCollections.map((collection) => (
                <div key={collection.id} className="tree-node">
                  <div
                    className="tree-row collection-row"
                    onClick={() => toggleExpand(collection.id)}
                    onContextMenu={(e) => handleContextMenu(e, collection, 'collection')}
                    title={`集合: ${collection.name}`}
                  >
                    <Icon
                      name={expandedIds.has(collection.id) ? 'arrow-down' : 'arrow-right'}
                      size={15}
                      color="var(--text-muted)"
                    />
                    {isRenamingCollection === collection.id ? (
                      <input
                        className="rename-input"
                        type="text"
                        value={renameCollectionValue}
                        onChange={(e) => setRenameCollectionValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCollectionConfirm();
                          if (e.key === 'Escape') setIsRenamingCollection(null);
                        }}
                        onBlur={handleRenameCollectionConfirm}
                        autoFocus
                        spellCheck={false}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <Icon
                          name={expandedIds.has(collection.id) ? 'folder-open' : 'folder-close'}
                          size={18}
                          color="#dcb67a"
                        />
                        <span className="tree-label">{collection.name}</span>
                      </>
                    )}
                    <div className="tree-hover-actions">
                      <button
                        className={`icon-btn xs more-btn ${openMoreMenu === collection.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMoreMenu === collection.id) {
                            setOpenMoreMenu(null);
                          } else {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMoreMenuPos({ top: rect.bottom + 2, left: rect.left - 120 });
                            setOpenMoreMenu(collection.id);
                          }
                        }}
                        title="更多操作 / More"
                      >
                        <Icon name="more" size={14} />
                      </button>
                      {openMoreMenu === collection.id && (
                        <div
                          className="more-dropdown animate-scale-in"
                          ref={moreMenuRef}
                          style={{ top: moreMenuPos.top, left: moreMenuPos.left }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameCollection(collection.id);
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="edit" size={13} /> 重命名
                          </button>
                          <button
                            className="context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              vscode.postMessage({
                                type: 'duplicateCollection',
                                payload: { collectionId: collection.id },
                              });
                              showToast('已复制集合');
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="copy" size={13} /> 复制集合
                          </button>
                          <button
                            className="context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNewRequestInCollection(collection.id);
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="send" size={13} /> 新建请求
                          </button>
                          <button
                            className="context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNewFolder(collection.id);
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="plus" size={13} /> 新建文件夹
                          </button>
                          <button
                            className="context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunCollection(collection.id, { maxParallel });
                              showToast('正在运行集合...');
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="play" size={13} /> 运行
                          </button>
                          <button
                            className="context-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCollection(collection);
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="upload" size={13} /> 导出
                          </button>
                          <div className="dropdown-divider" />
                          <button
                            className="context-menu-item danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCollection(collection.id);
                              setOpenMoreMenu(null);
                            }}
                          >
                            <Icon name="delete-bin" size={13} /> 删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isCreatingFolder === collection.id && !expandedIds.has(collection.id) && (
                    <div
                      className="create-form animate-scale-in"
                      style={{ paddingLeft: '26px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateFolder();
                          if (e.key === 'Escape') setIsCreatingFolder(null);
                        }}
                        placeholder="输入文件夹名称"
                        autoFocus
                        spellCheck={false}
                      />
                      <button className="icon-btn sm confirm" onClick={handleCreateFolder}>
                        <Icon name="check" size={16} />
                      </button>
                      <button
                        className="icon-btn sm danger"
                        onClick={() => setIsCreatingFolder(null)}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  )}
                  {expandedIds.has(collection.id) && (
                    <div className="tree-children animate-fade-in">
                      {isCreatingFolder === collection.id && (
                        <div
                          className="create-form animate-scale-in"
                          style={{ paddingLeft: '26px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateFolder();
                              if (e.key === 'Escape') setIsCreatingFolder(null);
                            }}
                            placeholder="输入文件夹名称"
                            autoFocus
                            spellCheck={false}
                          />
                          <button className="icon-btn sm confirm" onClick={handleCreateFolder}>
                            <Icon name="check" size={16} />
                          </button>
                          <button
                            className="icon-btn sm danger"
                            onClick={() => setIsCreatingFolder(null)}
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </div>
                      )}
                      {collection.folders.map((folder) => (
                        <div key={folder.id} className="tree-node">
                          <div
                            className="tree-row folder-row"
                            onClick={() => toggleExpand(folder.id)}
                            onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                            title={`文件夹: ${folder.name}`}
                          >
                            <Icon
                              name={expandedIds.has(folder.id) ? 'arrow-down' : 'arrow-right'}
                              size={13}
                              color="var(--text-muted)"
                            />
                            <Icon
                              name={expandedIds.has(folder.id) ? 'folder-open' : 'folder-close'}
                              size={16}
                              color="#6a9fd8"
                            />
                            {renamingFolderId === folder.id ? (
                              <input
                                className="rename-input"
                                type="text"
                                value={renameFolderValue}
                                onChange={(e) => setRenameFolderValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameFolderConfirm(folder.id);
                                  if (e.key === 'Escape') setRenamingFolderId(null);
                                }}
                                onBlur={() => handleRenameFolderConfirm(folder.id)}
                                autoFocus
                                spellCheck={false}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="tree-label">{folder.name}</span>
                            )}
                            <div className="tree-hover-actions">
                              <button
                                className={`icon-btn xs more-btn ${openMoreMenu === folder.id ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openMoreMenu === folder.id) {
                                    setOpenMoreMenu(null);
                                  } else {
                                    const rect = (
                                      e.currentTarget as HTMLElement
                                    ).getBoundingClientRect();
                                    setMoreMenuPos({ top: rect.bottom + 2, left: rect.left - 120 });
                                    setOpenMoreMenu(folder.id);
                                  }
                                }}
                                title="更多操作 / More"
                              >
                                <Icon name="more" size={13} />
                              </button>
                              {openMoreMenu === folder.id && (
                                <div
                                  className="more-dropdown animate-scale-in"
                                  ref={moreMenuRef}
                                  style={{ top: moreMenuPos.top, left: moreMenuPos.left }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    className="context-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingFolderId(folder.id);
                                      setRenameFolderValue(folder.name);
                                      setOpenMoreMenu(null);
                                    }}
                                  >
                                    <Icon name="edit" size={13} /> 重命名
                                  </button>
                                  <button
                                    className="context-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const colId = findCollectionIdByFolderId(folder.id);
                                      if (colId) {
                                        const parentFolderId = findParentFolderId(folder.id);
                                        const col = collections.find((c) => c.id === colId);
                                        let siblingNames: string[] = [];
                                        if (parentFolderId) {
                                          const findFolder = (folders: any[]): any => {
                                            for (const f of folders) {
                                              if (f.id === parentFolderId) return f;
                                              if (f.folders) { const found = findFolder(f.folders); if (found) return found; }
                                            }
                                            return null;
                                          };
                                          const parent = findFolder(col!.folders);
                                          siblingNames = parent ? parent.folders.map((f: any) => f.name) : [];
                                        } else {
                                          siblingNames = col ? col.folders.map((f: any) => f.name) : [];
                                        }
                                        const copyName = getNextCopyName(folder.name, siblingNames);
                                        vscode.postMessage({
                                          type: 'addFolder',
                                          payload: { collectionId: colId, parentFolderId: parentFolderId, name: copyName },
                                        });
                                        showToast('已复制文件夹');
                                      }
                                      setOpenMoreMenu(null);
                                    }}
                                  >
                                    <Icon name="copy" size={13} /> 复制文件夹
                                  </button>
                                  <button
                                    className="context-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNewRequestInCollection(
                                        findCollectionIdByFolderId(folder.id) || '',
                                        folder.id
                                      );
                                      setOpenMoreMenu(null);
                                    }}
                                  >
                                    <Icon name="send" size={13} /> 新建请求
                                  </button>
                                  {getFolderDepth(folder.id) < 2 && (
                                    <button
                                      className="context-menu-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsCreatingSubFolder(folder.id);
                                        setNewFolderName('');
                                        if (!expandedIds.has(folder.id)) toggleExpand(folder.id);
                                        setOpenMoreMenu(null);
                                      }}
                                    >
                                      <Icon name="plus" size={13} /> 新建文件夹
                                    </button>
                                  )}
                                  <div className="dropdown-divider" />
                                  <button
                                    className="context-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const requests = folder.requests || [];
                                      if (requests.length === 0) {
                                        showToast('文件夹中没有请求');
                                        setOpenMoreMenu(null);
                                        return;
                                      }
                                      requests.forEach((req: HttpRequest) => {
                                        vscode.postMessage({
                                          type: 'sendRequest',
                                          payload: { request: req },
                                        });
                                      });
                                      showToast(`正在运行文件夹中的 ${requests.length} 个请求...`);
                                      setOpenMoreMenu(null);
                                    }}
                                  >
                                    <Icon name="play" size={13} /> 运行
                                  </button>
                                  <button
                                    className="context-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const folderData = JSON.stringify(folder, null, 2);
                                      const blob = new Blob([folderData], {
                                        type: 'application/json',
                                      });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `${folder.name || 'folder'}.json`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                      showToast('已导出文件夹');
                                      setOpenMoreMenu(null);
                                    }}
                                  >
                                    <Icon name="upload" size={13} /> 导出
                                  </button>
                                  <div className="dropdown-divider" />
                                  <button
                                    className="context-menu-item danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      vscode.postMessage({
                                        type: 'deleteFolder',
                                        payload: { folderId: folder.id },
                                      });
                                      showToast('已删除文件夹');
                                      setOpenMoreMenu(null);
                                    }}
                                  >
                                    <Icon name="delete-bin" size={13} /> 删除
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {expandedIds.has(folder.id) && (
                            <div className="tree-children has-parent tree-children-depth-1 animate-fade-in">
                              {isCreatingSubFolder === folder.id && (
                                <div
                                  className="create-form animate-scale-in"
                                  style={{ paddingLeft: '40px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCreateSubFolder();
                                      if (e.key === 'Escape') setIsCreatingSubFolder(null);
                                    }}
                                    placeholder="输入文件夹名称"
                                    autoFocus
                                    spellCheck={false}
                                  />
                                  <button className="icon-btn sm confirm" onClick={handleCreateSubFolder}>
                                    <Icon name="check" size={16} />
                                  </button>
                                  <button
                                    className="icon-btn sm danger"
                                    onClick={() => setIsCreatingSubFolder(null)}
                                  >
                                    <Icon name="close" size={16} />
                                  </button>
                                </div>
                              )}
                              {folder.folders && folder.folders.map((sf: any) => renderSubFolder(sf, 2))}
                              {[...folder.requests]
                                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                                .map((req) => (
                                  <div
                                    key={req.id}
                                    className={`history-item tree-depth-1 ${req.pinned ? 'pinned' : ''} ${selectedRequestKey === `${folder.id}::${req.id}` ? 'selected' : ''}`}
                                    onClick={() => {
                                      onSelectRequest(req);
                                      setSelectedRequestKey(`${folder.id}::${req.id}`);
                                      setSelectedHistoryId(null);
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, req, 'request')}
                                    title={`${req.method} ${getDisplayName(req)}`}
                                  >
                                    <div className="history-item-top">
                                      {req.pinned && (
                                        <span className="pin-indicator" title="已置顶 / Pinned">
                                          <Icon name="to-top" size={12} color="var(--accent)" />
                                        </span>
                                      )}
                                      <span
                                        className="method-tag-pill"
                                        style={{
                                          backgroundColor:
                                            (METHOD_RAW_COLORS[req.method] || '#9cdcfe') + '22',
                                          color: METHOD_RAW_COLORS[req.method] || '#9cdcfe',
                                        }}
                                      >
                                        {req.method}
                                      </span>
                                      {renamingId === req.id ? (
                                        <input
                                          className="rename-input"
                                          type="text"
                                          value={renameValue}
                                          onChange={(e) => setRenameValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                              handleRenameRequestConfirm(req.id);
                                            if (e.key === 'Escape') setRenamingId(null);
                                          }}
                                          onBlur={() => handleRenameRequestConfirm(req.id)}
                                          autoFocus
                                          spellCheck={false}
                                          onFocus={(e) => e.target.select()}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <span className="history-url">
                                          {getDisplayName(req)}
                                        </span>
                                      )}
                                      <div className="tree-hover-actions">
                                        <button
                                          className="icon-btn xs danger"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteRequest(req.id);
                                          }}
                                          title="删除 / Delete"
                                        >
                                          <Icon name="delete-bin" size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="history-item-time">
                                      {req.name && req.url && req.name !== req.url ? req.url : ''}
                                      {req.createdAt
                                        ? (req.name && req.url && req.name !== req.url
                                            ? ' · '
                                            : '') +
                                          new Date(req.createdAt).toLocaleString('zh-CN', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })
                                        : ''}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {[...collection.requests]
                        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                        .map((req) => (
                          <div
                            key={req.id}
                            className={`history-item ${req.pinned ? 'pinned' : ''} ${selectedRequestKey === `${collection.id}::${req.id}` ? 'selected' : ''}`}
                            onClick={() => {
                              onSelectRequest(req);
                              setSelectedRequestKey(`${collection.id}::${req.id}`);
                              setSelectedHistoryId(null);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, req, 'request')}
                            title={`${req.method} ${req.name || req.url}`}
                          >
                            <div className="history-item-top">
                              {req.pinned && (
                                <span className="pin-indicator" title="已置顶 / Pinned">
                                  <Icon name="to-top" size={12} color="var(--accent)" />
                                </span>
                              )}
                              <span
                                className="method-tag-pill"
                                style={{
                                  backgroundColor:
                                    (METHOD_RAW_COLORS[req.method] || '#9cdcfe') + '22',
                                  color: METHOD_RAW_COLORS[req.method] || '#9cdcfe',
                                }}
                              >
                                {req.method}
                              </span>
                              {renamingId === req.id ? (
                                <input
                                  className="rename-input"
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameRequestConfirm(req.id);
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                  onBlur={() => handleRenameRequestConfirm(req.id)}
                                  autoFocus
                                  spellCheck={false}
                                  onFocus={(e) => e.target.select()}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="history-url">
                                  {(!req.name || req.name === '新建请求') && req.url
                                    ? req.url
                                    : req.name || req.url}
                                </span>
                              )}
                              <div className="tree-hover-actions">
                                <button
                                  className="icon-btn xs danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteRequest(req.id);
                                  }}
                                  title="删除 / Delete"
                                >
                                  <Icon name="delete-bin" size={13} />
                                </button>
                              </div>
                            </div>
                            <div className="history-item-time">
                              {req.name && req.url && req.name !== req.url ? req.url : ''}
                              {req.createdAt
                                ? (req.name && req.url && req.name !== req.url ? ' · ' : '') +
                                  new Date(req.createdAt).toLocaleString('zh-CN', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </div>
                          </div>
                        ))}
                      {collection.folders.length === 0 && collection.requests.length === 0 && (
                        <div className="tree-empty-hint animate-fade-in">
                          <Icon name="doc" size={16} color="var(--text-muted)" />
                          <span>暂无请求</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredCollections.length === 0 && !isCreating && (
                <div className="empty-state animate-fade-in">
                  <Icon name="collection" size={44} color="var(--text-muted)" />
                  <p className="empty-title">{filterText ? '无匹配结果' : '暂无集合'}</p>
                  <p className="empty-desc">
                    {filterText ? '尝试其他搜索关键词' : '创建集合来分组管理你的 API 接口'}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'environments' && (
            <div className="tab-content animate-fade-in">
              <div className="section-toolbar">
                <span className="section-label">环境变量</span>
                <div className="section-actions">
                  <button
                    className="icon-btn sm"
                    onClick={(e) => { e.stopPropagation(); handleImportEnvFile(); }}
                    title="导入 .env / Import .env"
                  >
                    <Icon name="doc" size={14} />
                  </button>
                  <button
                    className="icon-btn sm"
                    onClick={(e) => { e.stopPropagation(); setIsCreatingEnv(true); }}
                    title="新建环境 / New Environment"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                  <button
                    className="icon-btn sm"
                    onClick={(e) => { e.stopPropagation(); handleImportEnvironment(); }}
                    title="导入环境 / Import JSON"
                  >
                    <Icon name="download" size={14} />
                  </button>
                </div>
              </div>
              {isCreatingEnv && (
                <div className="create-form animate-scale-in" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateEnv();
                      if (e.key === 'Escape') setIsCreatingEnv(false);
                    }}
                    placeholder="输入环境名称"
                    autoFocus
                    spellCheck={false}
                  />
                  <button className="icon-btn sm confirm" onClick={handleCreateEnv}>
                    <Icon name="check" size={16} />
                  </button>
                  <button className="icon-btn sm danger" onClick={() => setIsCreatingEnv(false)}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
              <div className="env-manager">
                <div className="env-list-panel">
                  <div
                    className={`env-list-item globals-item ${selectedEnvItemId === '__globals__' ? 'active' : ''}`}
                    onClick={() => setSelectedEnvItemId('__globals__')}
                    title="全局变量：所有环境共享的变量，任何环境激活时都可引用"
                  >
                    <Icon name="earth" size={14} color="#dcb67a" />
                    <span className="env-list-name">全局变量</span>
                    <span className="env-list-count">{globalVariables.length}</span>
                  </div>
                  <div className="env-list-divider" />
                  {filteredEnvironments.map((env) => (
                    <div
                      key={env.id}
                      className={`env-list-item ${selectedEnvItemId === env.id ? 'active' : ''} ${activeEnvironmentId === env.id ? 'is-active-env' : ''}`}
                      onClick={() => setSelectedEnvItemId(env.id)}
                      onContextMenu={(e) => handleContextMenu(e, env, 'environment')}
                      title={`环境：${env.name}${activeEnvironmentId === env.id ? '（当前活动环境）' : ''}`}
                    >
                      <Icon name="folder" size={14} color="var(--accent)" />
                      <span className="env-list-name">{env.name}</span>
                      <span className="env-list-count">{env.variables?.length || 0}</span>
                    </div>
                  ))}
                  {filteredEnvironments.length === 0 && globalVariables.length === 0 && (
                    <div className="env-list-empty">
                      <Icon name="earth" size={32} color="var(--text-muted)" />
                      <p>暂无环境</p>
                    </div>
                  )}
                </div>
                <div className="env-detail-panel">
                  {selectedEnvItemId === '__globals__' && (
                    <div className="env-detail-content animate-fade-in globals-detail">
                      <div className="env-detail-header globals-header">
                        <div className="env-detail-title-row">
                          <Icon name="earth" size={16} color="#dcb67a" />
                          <span className="env-detail-title globals-title">全局变量</span>
                          <span className="env-help-icon" title="全局变量在所有环境中都生效&#10;在请求中使用 {{变量名}} 引用&#10;若与环境变量同名，环境变量优先">
                            <Icon name="info" size={13} color="var(--text-muted)" />
                          </span>
                        </div>
                      </div>
                      <div className="env-var-table">
                        {globalVariables.map((v: any) => (
                          <div key={v.key} className="env-var-row" title={`全局变量：{{${v.key}}} = ${v.type === 'secret' ? '****' : v.value}`}>
                            <input
                              className="kv-key"
                              type="text"
                              value={v.key}
                              readOnly
                              title="变量名，在请求中使用 {{变量名}} 引用"
                            />
                            <input
                              className="kv-value"
                              type={v.type === 'secret' ? 'password' : 'text'}
                              value={String(v.value)}
                              onChange={(e) =>
                                handleUpdateGlobalVar({ key: v.key, value: e.target.value, type: v.type, enabled: v.enabled })
                              }
                              spellCheck={false}
                              title={v.type === 'secret' ? '密钥变量值（已掩码）' : '变量值'}
                            />
                            <button
                              className="icon-btn xs"
                              onClick={() =>
                                handleUpdateGlobalVar({ key: v.key, value: v.value, type: v.type === 'secret' ? 'default' : 'secret', enabled: v.enabled })
                              }
                              title={v.type === 'secret' ? '设为普通变量' : '设为密钥变量'}
                            >
                              <Icon name={v.type === 'secret' ? 'lock' : 'unlock'} size={12} />
                            </button>
                            <button
                              className="icon-btn xs danger"
                              onClick={() => handleDeleteGlobalVar(v.key)}
                              title="删除变量"
                            >
                              <Icon name="close" size={12} />
                            </button>
                          </div>
                        ))}
                        <div className="env-var-row new-row">
                          <input
                            className="kv-key"
                            type="text"
                            value={newGlobalVarKey}
                            onChange={(e) => setNewGlobalVarKey(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newGlobalVarKey.trim()) {
                                handleAddGlobalVar();
                              }
                              if (e.key === 'Tab' && newGlobalVarKey.trim() && !e.shiftKey) {
                                e.preventDefault();
                                handleAddGlobalVar();
                              }
                            }}
                            onBlur={() => {
                              if (newGlobalVarKey.trim()) {
                                handleAddGlobalVar();
                              }
                            }}
                            placeholder="变量名"
                            spellCheck={false}
                          />
                          <input
                            className="kv-value"
                            type="text"
                            value={newGlobalVarValue}
                            onChange={(e) => setNewGlobalVarValue(e.target.value)}
                            placeholder="变量值"
                            spellCheck={false}
                          />
                          <button
                            className="icon-btn xs"
                            onClick={() => {
                              if (newGlobalVarKey.trim()) {
                                handleAddGlobalVar();
                              }
                            }}
                            title="添加变量"
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>
                        {globalVariables.length === 0 && !newGlobalVarKey && (
                          <div className="kv-empty">输入变量名开始添加</div>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedEnvItemId && selectedEnvItemId !== '__globals__' && (() => {
                    const env = environments.find((e) => e.id === selectedEnvItemId);
                    if (!env) return <div className="kv-empty">选择一个环境</div>;
                    const isActive = activeEnvironmentId === env.id;
                    return (
                      <div className="env-detail-content animate-fade-in env-detail">
                        <div className="env-detail-header env-header">
                          <div className="env-detail-title-row">
                            {isRenamingEnv === env.id ? (
                              <input
                                className="rename-input"
                                type="text"
                                value={renameEnvValue}
                                onChange={(e) => setRenameEnvValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameEnvConfirm();
                                  if (e.key === 'Escape') setIsRenamingEnv(null);
                                }}
                                onBlur={handleRenameEnvConfirm}
                                autoFocus
                                spellCheck={false}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <Icon name="folder" size={16} color="var(--accent)" />
                                <span className="env-detail-title env-title">{env.name}</span>
                                {isActive && <span className="env-active-badge">活动</span>}
                                <span className="env-help-icon" title={`环境"${env.name}"的专属变量&#10;激活此环境后，请求中的 {{变量名}} 会被替换为对应值&#10;环境变量优先级高于全局变量`}>
                                  <Icon name="info" size={13} color="var(--text-muted)" />
                                </span>
                              </>
                            )}
                          </div>
                          <div className="env-detail-actions">
                            {!isActive && (
                              <button
                                className="env-action-btn activate"
                                onClick={() => onSwitchEnvironment(env.id)}
                                title="设为活动环境"
                              >
                                <Icon name="check" size={12} /> 激活
                              </button>
                            )}
                            <button
                              className="icon-btn xs"
                              onClick={() => handleRenameEnv(env.id)}
                              title="重命名"
                            >
                              <Icon name="edit" size={13} />
                            </button>
                            <button
                              className="icon-btn xs"
                              onClick={() => handleDuplicateEnv(env.id)}
                              title="复制环境"
                            >
                              <Icon name="copy" size={13} />
                            </button>
                            <button
                              className="icon-btn xs"
                              onClick={() => handleImportEnvFile(env.id)}
                              title="导入 .env"
                            >
                              <Icon name="doc" size={13} />
                            </button>
                            <button
                              className="icon-btn xs"
                              onClick={() => handleExportEnvironment(env)}
                              title="导出环境"
                            >
                              <Icon name="upload" size={13} />
                            </button>
                            <button
                              className="icon-btn xs danger"
                              onClick={() => handleDeleteEnv(env.id)}
                              title="删除环境"
                            >
                              <Icon name="delete-bin" size={13} />
                            </button>
                          </div>
                        </div>
                        {globalVariables.length > 0 && (
                          <div className="env-inherited-section">
                            <div className="env-section-label">
                              <Icon name="earth" size={12} color="#dcb67a" />
                              <span>继承的全局变量</span>
                              <span className="env-section-label-hint">（环境变量同名时覆盖全局）</span>
                            </div>
                            <div className="env-var-table inherited">
                              {globalVariables.map((gv: any) => {
                                const overridden = env.variables?.some((ev: any) => ev.key === gv.key);
                                return (
                                  <div key={gv.key} className={`env-var-row inherited-row ${overridden ? 'overridden' : ''}`}>
                                    <input className="kv-key inherited" type="text" value={gv.key} readOnly />
                                    <input
                                      className="kv-value inherited"
                                      type={gv.type === 'secret' ? 'password' : 'text'}
                                      value={String(gv.value)}
                                      readOnly
                                    />
                                    {overridden && <span className="override-badge">已覆盖</span>}
                                    <span className="inherited-icon" title="来自全局变量">
                                      <Icon name="earth" size={11} color="#dcb67a" />
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="env-section-label">
                          <Icon name="folder" size={12} color="var(--accent)" />
                          <span>环境变量</span>
                        </div>
                        <div className="env-var-table">
                          {Array.isArray(env.variables) && env.variables.map((v: any) => (
                            <div key={v.key} className="env-var-row" title={`环境变量：{{${v.key}}} = ${v.type === 'secret' ? '****' : v.value}`}>
                              <input
                                className="kv-key"
                                type="text"
                                value={v.key}
                                readOnly
                                title="变量名，在请求中使用 {{变量名}} 引用"
                              />
                              <input
                                className="kv-value"
                                type={v.type === 'secret' ? 'password' : 'text'}
                                value={String(v.value)}
                                onChange={(e) =>
                                  onUpdateVariable(env.id, {
                                    key: v.key,
                                    value: e.target.value,
                                    type: v.type,
                                    enabled: v.enabled,
                                  })
                                }
                                spellCheck={false}
                                title={v.type === 'secret' ? '密钥变量值（已掩码）' : '变量值'}
                              />
                              <button
                                className="icon-btn xs"
                                onClick={() =>
                                  onUpdateVariable(env.id, {
                                    key: v.key,
                                    value: v.value,
                                    type: v.type === 'secret' ? 'default' : 'secret',
                                    enabled: v.enabled,
                                  })
                                }
                                title={v.type === 'secret' ? '设为普通变量' : '设为密钥变量'}
                              >
                                <Icon name={v.type === 'secret' ? 'lock' : 'unlock'} size={12} />
                              </button>
                              <button
                                className="icon-btn xs danger"
                                onClick={() => handleDeleteEnvVar(env.id, v.key)}
                                title="删除变量"
                              >
                                <Icon name="close" size={12} />
                              </button>
                            </div>
                          ))}
                          <div className="env-var-row new-row">
                            <input
                              className="kv-key"
                              type="text"
                              value={newVarKey}
                              onChange={(e) => setNewVarKey(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newVarKey.trim()) {
                                  handleAddEnvVar(env.id);
                                }
                                if (e.key === 'Tab' && newVarKey.trim() && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddEnvVar(env.id);
                                }
                              }}
                              onBlur={() => {
                                if (newVarKey.trim()) {
                                  handleAddEnvVar(env.id);
                                }
                              }}
                              placeholder="变量名"
                              spellCheck={false}
                            />
                            <input
                              className="kv-value"
                              type="text"
                              value={newVarValue}
                              onChange={(e) => setNewVarValue(e.target.value)}
                              placeholder="变量值"
                              spellCheck={false}
                            />
                            <button
                              className="icon-btn xs"
                              onClick={() => {
                                if (newVarKey.trim()) {
                                  handleAddEnvVar(env.id);
                                }
                              }}
                              title="添加变量"
                            >
                              <Icon name="plus" size={14} />
                            </button>
                          </div>
                          {(!env.variables || (Array.isArray(env.variables) && env.variables.length === 0)) && !newVarKey && (
                            <div className="kv-empty">输入变量名开始添加</div>
                          )}
                        </div>
                        {(env.variables?.length > 0 || globalVariables.length > 0) && (() => {
                          const mergedVars: Record<string, string> = {};
                          for (const gv of globalVariables) {
                            if (gv.enabled !== false) mergedVars[gv.key] = gv.type === 'secret' ? '****' : String(gv.value);
                          }
                          for (const ev of env.variables || []) {
                            if (ev.enabled !== false) mergedVars[ev.key] = ev.type === 'secret' ? '****' : String(ev.value);
                          }
                          const exampleUrl = mergedVars['base_url']
                            ? `${mergedVars['base_url']}/api/users`
                            : '{{base_url}}/api/users';
                          const varKeys = Object.keys(mergedVars);
                          return (
                            <div className="env-preview-section">
                              <div className="env-section-label">
                                <Icon name="preview" size={12} color="var(--text-muted)" />
                                <span>解析预览</span>
                                <span className="env-help-icon" title="激活此环境后，请求中的 {{变量名}} 会被替换为实际值&#10;例如：{{base_url}}/api → https://api.example.com/api">
                                  <Icon name="info" size={11} color="var(--text-muted)" />
                                </span>
                              </div>
                              <div className="env-preview-box">
                                <div className="env-preview-row">
                                  <span className="env-preview-label">请求 URL：</span>
                                  <code className="env-preview-code">{exampleUrl}</code>
                                </div>
                                {varKeys.length > 0 && (
                                  <div className="env-preview-vars">
                                    {varKeys.map((key) => (
                                      <div key={key} className="env-preview-var">
                                        <code className="env-preview-key">{'{{' + key + '}}'}</code>
                                        <span className="env-preview-arrow">→</span>
                                        <span className="env-preview-val">{mergedVars[key]}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                  {!selectedEnvItemId && (
                    <div className="env-detail-empty">
                      <Icon name="earth" size={36} color="var(--text-muted)" />
                      <p>选择左侧环境查看变量</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {contextMenu && (
          <div
            className="context-menu-overlay"
            onClick={() => {
              setContextMenu(null);
              setShowAddToCollection(null);
            }}
          >
            <div
              className="context-menu animate-scale-in"
              ref={contextRef}
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 200),
                top: Math.min(contextMenu.y, window.innerHeight - 300),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'history' && (
                <>
                  <button className="context-menu-item" onClick={handleRenameHistory}>
                    <Icon name="edit" size={14} />
                    重命名
                  </button>
                  <button className="context-menu-item" onClick={handleCopyRequest}>
                    <Icon name="copy" size={14} />
                    复制请求
                  </button>
                  <button className="context-menu-item" onClick={handleResend}>
                    <Icon name="send" size={14} />
                    重发请求
                  </button>
                  <button className="context-menu-item" onClick={handlePin}>
                    <Icon name={contextMenu.target.pinned ? 'to-top' : 'pushpin'} size={14} />
                    {contextMenu.target.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <div className="dropdown-divider" />
                  <div
                    className="context-menu-item has-submenu"
                    onMouseEnter={() => {
                      setShowAddToCollection({
                        entry: contextMenu.target,
                        x: contextMenu.x + 160,
                        y: contextMenu.y,
                      });
                    }}
                    onMouseLeave={() => {
                      setShowAddToCollection(null);
                    }}
                  >
                    <Icon name="folder-focus" size={14} />
                    添加到集合
                    <span className="submenu-arrow">›</span>
                    {showAddToCollection && contextMenu.type === 'history' && (
                      <div
                        className="context-submenu"
                        onMouseEnter={() => {
                          setShowAddToCollection({
                            entry: contextMenu.target,
                            x: contextMenu.x + 160,
                            y: contextMenu.y,
                          });
                        }}
                        onMouseLeave={() => {
                          setShowAddToCollection(null);
                        }}
                      >
                        {collections.length > 0 ? (
                          collections.map((c) => (
                            <div key={c.id}>
                              <button
                                className="context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCollection(contextMenu.target, c.id);
                                }}
                              >
                                <Icon name="collection" size={13} />
                                {c.name}
                              </button>
                              {c.folders.length > 0 &&
                                c.folders.map((f) => (
                                  <button
                                    key={f.id}
                                    className="context-menu-item"
                                    style={{ paddingLeft: 28 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCollection(contextMenu.target, c.id, f.id);
                                    }}
                                  >
                                    <Icon name="folder-close" size={13} />
                                    {f.name}
                                  </button>
                                ))}
                            </div>
                          ))
                        ) : (
                          <span className="context-menu-hint">暂无集合，请先创建</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="dropdown-divider" />
                  <button className="context-menu-item danger" onClick={handleDeleteHistory}>
                    <Icon name="delete-bin" size={14} />
                    删除
                  </button>
                </>
              )}
              {contextMenu.type === 'collection' && (
                <>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleRenameCollection(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="edit" size={14} />
                    重命名
                  </button>
                  <button className="context-menu-item" onClick={handleCopyRequest}>
                    <Icon name="copy" size={14} />
                    复制集合
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleNewRequestInCollection(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="send" size={14} />
                    新建请求
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleNewFolder(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="plus" size={14} />
                    新建文件夹
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      onRunCollection(contextMenu.targetId, { maxParallel });
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="play" size={14} />
                    运行集合
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleExportCollection(contextMenu.target);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="upload" size={14} />
                    导出集合
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="context-menu-item danger"
                    onClick={() => {
                      onDeleteCollection(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="delete-bin" size={14} />
                    删除集合
                  </button>
                </>
              )}
              {contextMenu.type === 'request' && (
                <>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      if (contextMenu.targetId) {
                        handleRenameRequest(contextMenu.targetId);
                      } else {
                        showToast('重命名失败: 未找到请求ID');
                      }
                    }}
                  >
                    <Icon name="edit" size={14} />
                    重命名
                  </button>
                  <button className="context-menu-item" onClick={handleCopyRequest}>
                    <Icon name="copy" size={14} />
                    复制请求
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      if (contextMenu.targetId) {
                        setResendingIds((prev) => new Set(prev).add(contextMenu.targetId));
                      }
                      vscode.postMessage({
                        type: 'sendRequest',
                        payload: { request: contextMenu.target },
                      });
                      vscode.postMessage({
                        type: 'openEditor',
                        payload: { request: contextMenu.target, autoSend: true },
                      });
                      showToast('正在重发请求...');
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="send" size={14} />
                    重发请求
                  </button>
                  <button className="context-menu-item" onClick={handlePin}>
                    <Icon name={contextMenu.target.pinned ? 'to-top' : 'pushpin'} size={14} />
                    {contextMenu.target.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <div className="dropdown-divider" />
                  <div
                    className="context-menu-item has-submenu"
                    onMouseEnter={() => {
                      setShowAddToCollection({
                        entry: {
                          id: contextMenu.targetId,
                          request: contextMenu.target,
                          response: {
                            status: 0,
                            statusText: '',
                            headers: {},
                            body: '',
                            time: 0,
                            size: 0,
                            cookies: [],
                          },
                          timestamp: Date.now(),
                        },
                        x: contextMenu.x + 160,
                        y: contextMenu.y,
                      });
                    }}
                    onMouseLeave={() => {
                      setShowAddToCollection(null);
                    }}
                  >
                    <Icon name="folder-focus" size={14} />
                    添加到集合
                    <span className="submenu-arrow">›</span>
                    {showAddToCollection && contextMenu.type === 'request' && (
                      <div
                        className="context-submenu"
                        onMouseEnter={() => {
                          setShowAddToCollection((prev) => prev);
                        }}
                        onMouseLeave={() => {
                          setShowAddToCollection(null);
                        }}
                      >
                        {collections.length > 0 ? (
                          collections.map((c) => (
                            <div key={c.id}>
                              <button
                                className="context-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCollection(showAddToCollection.entry, c.id);
                                }}
                              >
                                <Icon name="collection" size={13} />
                                {c.name}
                              </button>
                              {c.folders.length > 0 &&
                                c.folders.map((f) => (
                                  <button
                                    key={f.id}
                                    className="context-menu-item"
                                    style={{ paddingLeft: 28 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCollection(showAddToCollection.entry, c.id, f.id);
                                    }}
                                  >
                                    <Icon name="folder-close" size={13} />
                                    {f.name}
                                  </button>
                                ))}
                            </div>
                          ))
                        ) : (
                          <span className="context-menu-hint">暂无集合，请先创建</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="dropdown-divider" />
                  <button
                    className="context-menu-item danger"
                    onClick={() => {
                      if (contextMenu.targetId) {
                        onDeleteRequest(contextMenu.targetId);
                        showToast('已删除请求');
                      } else {
                        showToast('删除失败: 未找到请求ID');
                      }
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="delete-bin" size={14} />
                    删除请求
                  </button>
                </>
              )}
              {contextMenu.type === 'folder' && (
                <>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleRenameFolder(contextMenu.targetId);
                    }}
                  >
                    <Icon name="edit" size={14} />
                    重命名
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      const colId = findCollectionIdByFolderId(contextMenu.targetId);
                      if (colId) {
                        const parentFolderId = findParentFolderId(contextMenu.targetId);
                        const col = collections.find((c) => c.id === colId);
                        let siblingNames: string[] = [];
                        if (parentFolderId) {
                          const findFolder = (folders: any[]): any => {
                            for (const f of folders) {
                              if (f.id === parentFolderId) return f;
                              if (f.folders) { const found = findFolder(f.folders); if (found) return found; }
                            }
                            return null;
                          };
                          const parent = findFolder(col!.folders);
                          siblingNames = parent ? parent.folders.map((f: any) => f.name) : [];
                        } else {
                          siblingNames = col ? col.folders.map((f: any) => f.name) : [];
                        }
                        const copyName = getNextCopyName(contextMenu.target.name, siblingNames);
                        vscode.postMessage({
                          type: 'addFolder',
                          payload: { collectionId: colId, parentFolderId: parentFolderId, name: copyName },
                        });
                        showToast('已复制文件夹');
                      }
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="copy" size={14} />
                    复制文件夹
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      const colId = findCollectionIdByFolderId(contextMenu.targetId);
                      if (colId) handleNewRequestInCollection(colId, contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="send" size={14} />
                    新建请求
                  </button>
                  {getFolderDepth(contextMenu.targetId) < 2 && (
                    <>
                      <button
                        className="context-menu-item"
                        onClick={() => {
                          setIsCreatingSubFolder(contextMenu.targetId);
                          setNewFolderName('');
                          if (!expandedIds.has(contextMenu.targetId)) toggleExpand(contextMenu.targetId);
                          setContextMenu(null);
                        }}
                      >
                        <Icon name="plus" size={14} />
                        新建文件夹
                      </button>
                      <div className="dropdown-divider" />
                    </>
                  )}
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      const requests = contextMenu.target.requests || [];
                      if (requests.length === 0) {
                        showToast('文件夹中没有请求');
                        setContextMenu(null);
                        return;
                      }
                      requests.forEach((req: HttpRequest) => {
                        vscode.postMessage({ type: 'sendRequest', payload: { request: req } });
                      });
                      showToast(`正在运行文件夹中的 ${requests.length} 个请求...`);
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="play" size={14} />
                    运行
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      const folderData = JSON.stringify(contextMenu.target, null, 2);
                      const blob = new Blob([folderData], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${contextMenu.target.name || 'folder'}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast('已导出文件夹');
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="upload" size={14} />
                    导出
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="context-menu-item danger"
                    onClick={() => {
                      vscode.postMessage({
                        type: 'deleteFolder',
                        payload: { folderId: contextMenu.targetId },
                      });
                      showToast('已删除文件夹');
                      setContextMenu(null);
                    }}
                  >
                    <Icon name="delete-bin" size={14} />
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {showCurlDialog && (
          <div
            className="curl-dialog-overlay"
            onClick={() => {
              setShowCurlDialog(false);
              setCurlText('');
            }}
          >
            <div className="curl-dialog-content" onClick={(e) => e.stopPropagation()}>
              <div className="curl-dialog-header">
                <span>导入 cURL</span>
                <div className="curl-dialog-header-right">
                  <div className="raw-toggle-wrap" title="原始格式 / Raw format">
                    <span className="raw-toggle-label">Raw</span>
                    <div
                      className={`raw-toggle ${curlRaw ? 'active' : ''}`}
                      onClick={() => setCurlRaw(!curlRaw)}
                    >
                      <div className="raw-toggle-knob" />
                    </div>
                  </div>
                  <button
                    className="icon-btn sm"
                    onClick={() => {
                      setShowCurlDialog(false);
                      setCurlText('');
                    }}
                    title="关闭 / Close"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>
              <div className="curl-dialog-body">
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0' }}>
                  {curlRaw ? '直接输入 URL 地址，将以 GET 请求导入' : '粘贴 cURL 命令以导入请求，支持 curl、wget 等格式'}
                </p>
                <textarea
                  className="curl-input"
                  value={curlText}
                  onChange={(e) => setCurlText(e.target.value)}
                  placeholder={curlRaw ? 'https://api.example.com/users' : `curl --location 'https://api.example.com/users' \\\n--header 'Content-Type: application/json'`}
                  spellCheck={false}
                  autoFocus
                />
              </div>
              <div className="curl-dialog-footer">
                <button
                  className="btn-secondary sm"
                  onClick={() => {
                    navigator.clipboard
                      .readText()
                      .then((text) => {
                        setCurlText(text);
                        showToast('已从剪贴板粘贴');
                      })
                      .catch(() => showToast('无法读取剪贴板'));
                  }}
                  title="从剪贴板粘贴"
                >
                  <Icon name="copy" size={14} />
                  粘贴
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary sm"
                    onClick={() => {
                      setShowCurlDialog(false);
                      setCurlText('');
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="btn-primary sm"
                    onClick={() => {
                      if (!curlText.trim()) {
                        showToast('请输入 cURL 命令');
                        return;
                      }
                      vscode.postMessage({ type: 'importCurl', payload: { curl: curlText, raw: curlRaw } });
                      setShowCurlDialog(false);
                      setCurlText('');
                      showToast('正在导入 cURL...');
                    }}
                    disabled={!curlText.trim()}
                  >
                    导入
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showImportDialog && (
          <div className="curl-dialog-overlay" onClick={() => onImportDialogClose()}>
            <div className="curl-dialog-content" onClick={(e) => e.stopPropagation()}>
              <div className="curl-dialog-header">
                <span>导入集合</span>
                <button
                  className="toolbar-icon-btn sm"
                  onClick={() => onImportDialogClose()}
                  title="关闭 / Close"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <div className="curl-dialog-body">
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  选择导入格式
                </p>
                <div className="import-format-list">
                  {[
                    {
                      key: 'postman' as const,
                      label: 'Postman',
                      desc: 'Postman Collection v2.1',
                      icon: 'api',
                    },
                    {
                      key: 'openapi' as const,
                      label: 'OpenAPI',
                      desc: 'OpenAPI / Swagger 3.0',
                      icon: 'doc',
                    },
                    {
                      key: 'curl' as const,
                      label: 'cURL',
                      desc: '从剪贴板导入 cURL 命令',
                      icon: 'code',
                    },
                  ].map((fmt) => (
                    <label
                      key={fmt.key}
                      className={`import-format-item ${importFormat === fmt.key ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="importFormat"
                        checked={importFormat === fmt.key}
                        onChange={() => setImportFormat(fmt.key)}
                        style={{ display: 'none' }}
                      />
                      <Icon
                        name={fmt.icon}
                        size={20}
                        color={importFormat === fmt.key ? 'var(--accent)' : 'var(--text-muted)'}
                      />
                      <div className="import-format-info">
                        <span className="import-format-name">{fmt.label}</span>
                        <span className="import-format-desc">{fmt.desc}</span>
                      </div>
                      <span
                        className={`import-format-check ${importFormat === fmt.key ? 'visible' : ''}`}
                      >
                        <Icon name="check" size={14} />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="curl-dialog-footer">
                <button className="btn-secondary sm" onClick={() => onImportDialogClose()}>
                  取消
                </button>
                <button
                  className="btn-primary sm"
                  onClick={() => {
                    if (importFormat === 'curl') {
                      onImportDialogClose();
                      _onImportCurl?.();
                    } else {
                      onImportCollection(importFormat);
                      onImportDialogClose();
                      showToast('正在导入集合...');
                    }
                  }}
                >
                  导入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
