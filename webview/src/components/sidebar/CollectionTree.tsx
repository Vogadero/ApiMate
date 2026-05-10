import React, { useState } from 'react';
import { Collection, Folder, HttpRequest, METHOD_COLORS } from '../../types/api';
import { vscode } from '../../utils/vscode';
import './CollectionTree.css';

interface CollectionTreeProps {
  collections: Collection[];
  onSelectRequest: (request: HttpRequest) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onRunCollection: (collectionId: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const CollectionTree: React.FC<CollectionTreeProps> = ({
  collections, onSelectRequest, onCreateCollection, onDeleteCollection, onDeleteRequest, onRunCollection,
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const toggleCollection = (id: string) => { const n = new Set(expandedCollections); if (n.has(id)) n.delete(id); else n.add(id); setExpandedCollections(n); };
  const toggleFolder = (id: string) => { const n = new Set(expandedFolders); if (n.has(id)) n.delete(id); else n.add(id); setExpandedFolders(n); };

  const handleCreate = () => {
    if (newCollectionName.trim()) { onCreateCollection(newCollectionName.trim()); setNewCollectionName(''); setIsCreating(false); }
  };

  const handleNewRequest = () => {
    const newRequest: HttpRequest = {
      id: generateId(),
      name: '新建请求',
      method: 'GET',
      url: 'https://httpbin.org/get',
      headers: {},
      queryParams: {},
    };
    onSelectRequest(newRequest);
  };

  const handleImport = () => {
    vscode.postMessage({ type: 'importCollection', payload: { format: 'postman' } });
  };

  const renderRequest = (request: HttpRequest) => (
    <div key={request.id} className="tree-item request-item" onClick={() => onSelectRequest(request)}>
      <span className="method-badge" style={{ color: METHOD_COLORS[request.method] }}>{request.method}</span>
      <span className="request-name">{request.name}</span>
      <button className="tree-action" onClick={(e) => { e.stopPropagation(); onDeleteRequest(request.id); }} title="删除请求"><i className="ri-delete-bin-line" /></button>
    </div>
  );

  const renderFolder = (folder: Folder, depth: number = 1) => (
    <div key={folder.id} className="tree-folder">
      <div className="tree-item folder-item" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => toggleFolder(folder.id)}>
        <i className={`ri-arrow-${expandedFolders.has(folder.id) ? 'down' : 'right'}-s-line`} />
        <i className="ri-folder-line" />
        <span>{folder.name}</span>
      </div>
      {expandedFolders.has(folder.id) && (
        <div className="folder-children">
          {folder.folders.map((f) => renderFolder(f, depth + 1))}
          {folder.requests.map((r) => (<div key={r.id} style={{ paddingLeft: 8 + (depth + 1) * 12 }}>{renderRequest(r)}</div>))}
        </div>
      )}
    </div>
  );

  return (
    <div className="collection-tree">
      <div className="tree-header">
        <span>集合</span>
        <div className="tree-header-actions">
          <button className="header-action" onClick={handleNewRequest} title="新建请求"><i className="ri-add-circle-line" /></button>
          <button className="header-action" onClick={() => setIsCreating(true)} title="新建集合"><i className="ri-folder-add-line" /></button>
          <button className="header-action" onClick={handleImport} title="导入"><i className="ri-download-line" /></button>
        </div>
      </div>
      {isCreating && (
        <div className="new-collection-form">
          <input type="text" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }} placeholder="集合名称" autoFocus spellCheck={false} />
          <button className="form-confirm" onClick={handleCreate}><i className="ri-check-line" /></button>
          <button className="form-cancel" onClick={() => setIsCreating(false)}><i className="ri-close-line" /></button>
        </div>
      )}
      {collections.map((collection) => (
        <div key={collection.id} className="tree-collection">
          <div className="tree-item collection-item" onClick={() => toggleCollection(collection.id)}>
            <i className={`ri-arrow-${expandedCollections.has(collection.id) ? 'down' : 'right'}-s-line`} />
            <i className="ri-folder-3-line" />
            <span className="collection-name">{collection.name}</span>
            <div className="collection-actions">
              <button className="tree-action" onClick={(e) => { e.stopPropagation(); onRunCollection(collection.id); }} title="运行集合"><i className="ri-play-line" /></button>
              <button className="tree-action" onClick={(e) => { e.stopPropagation(); onDeleteCollection(collection.id); }} title="删除集合"><i className="ri-delete-bin-line" /></button>
            </div>
          </div>
          {expandedCollections.has(collection.id) && (
            <div className="collection-children">
              {collection.folders.map((f) => renderFolder(f))}
              {collection.requests.map((r) => renderRequest(r))}
              {collection.folders.length === 0 && collection.requests.length === 0 && <div className="empty-message">空集合</div>}
            </div>
          )}
        </div>
      ))}
      {collections.length === 0 && !isCreating && (
        <div className="tree-empty-state">
          <i className="ri-folder-line" />
          <p>暂无集合</p>
          <button className="tree-empty-action" onClick={() => setIsCreating(true)}>
            <i className="ri-add-line" /> 创建第一个集合
          </button>
        </div>
      )}
    </div>
  );
};
