import { useCallback } from 'react';
import { HttpRequest, HttpMethod, RequestBody, FormDataField, METHOD_COLORS } from '../../types/api';
import './RequestEditor.css';

interface RequestEditorProps {
  request: HttpRequest;
  onRequestChange: (request: HttpRequest) => void;
  onSend: (request: HttpRequest) => void;
  isLoading: boolean;
  activeTab: 'params' | 'headers' | 'body';
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const BODY_TYPES = ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw', 'binary', 'graphql'] as const;
const BODY_TYPE_LABELS: Record<string, string> = {
  'none': '无',
  'json': 'JSON',
  'form-data': '表单数据',
  'x-www-form-urlencoded': 'x-www-form',
  'raw': '原始',
  'binary': '二进制',
  'graphql': 'GraphQL',
};

export const RequestEditor: React.FC<RequestEditorProps> = ({
  request,
  onRequestChange,
  onSend,
  isLoading,
  activeTab,
}) => {
  const updateField = useCallback(<K extends keyof HttpRequest>(key: K, value: HttpRequest[K]) => {
    onRequestChange({ ...request, [key]: value });
  }, [request, onRequestChange]);

  const updateQueryParam = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const entries = Object.entries(request.queryParams);
    entries[index] = [field === 'key' ? value : entries[index]![0], field === 'value' ? value : entries[index]![1]];
    const newParams: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k) newParams[k] = v;
    }
    onRequestChange({ ...request, queryParams: newParams });
  }, [request, onRequestChange]);

  const addQueryParam = useCallback(() => {
    const newParams = { ...request.queryParams, '': '' };
    onRequestChange({ ...request, queryParams: newParams });
  }, [request, onRequestChange]);

  const removeQueryParam = useCallback((key: string) => {
    const newParams = { ...request.queryParams };
    delete newParams[key];
    onRequestChange({ ...request, queryParams: newParams });
  }, [request, onRequestChange]);

  const updateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const entries = Object.entries(request.headers);
    entries[index] = [field === 'key' ? value : entries[index]![0], field === 'value' ? value : entries[index]![1]];
    const newHeaders: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k) newHeaders[k] = v;
    }
    onRequestChange({ ...request, headers: newHeaders });
  }, [request, onRequestChange]);

  const addHeader = useCallback(() => {
    const newHeaders = { ...request.headers, '': '' };
    onRequestChange({ ...request, headers: newHeaders });
  }, [request, onRequestChange]);

  const removeHeader = useCallback((key: string) => {
    const newHeaders = { ...request.headers };
    delete newHeaders[key];
    onRequestChange({ ...request, headers: newHeaders });
  }, [request, onRequestChange]);

  const updateBody = useCallback((body: RequestBody | undefined) => {
    onRequestChange({ ...request, body: body as any });
  }, [request, onRequestChange]);

  const handleSend = useCallback(() => {
    onSend(request);
  }, [request, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const queryEntries = Object.entries(request.queryParams);
  const headerEntries = Object.entries(request.headers);

  return (
    <div className="request-editor" onKeyDown={handleKeyDown}>
      {activeTab === 'params' && (
        <div className="params-editor">
          <div className="url-bar">
            <select
              className="method-select"
              value={request.method}
              onChange={(e) => updateField('method', e.target.value as HttpMethod)}
              style={{ color: METHOD_COLORS[request.method] }}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>
              ))}
            </select>
            <input
              className="url-input"
              type="text"
              value={request.url}
              onChange={(e) => updateField('url', e.target.value)}
              placeholder="输入请求 URL"
              spellCheck={false}
            />
            <button className={`send-button ${isLoading ? 'loading' : ''}`} onClick={handleSend} disabled={isLoading}>
              {isLoading ? '发送中...' : '发送'}
            </button>
          </div>

          <div className="name-input-row">
            <input className="request-name-input" type="text" value={request.name} onChange={(e) => updateField('name', e.target.value)} placeholder="请求名称" />
          </div>

          <div className="key-value-editor">
            <div className="key-value-header">
              <span>查询参数</span>
              <button className="add-button" onClick={addQueryParam}><i className="ri-add-line" /> 添加</button>
            </div>
            {queryEntries.map(([key, value], index) => (
              <div key={index} className="key-value-row">
                <input className="kv-key" type="text" value={key} onChange={(e) => updateQueryParam(index, 'key', e.target.value)} placeholder="键" spellCheck={false} />
                <input className="kv-value" type="text" value={value} onChange={(e) => updateQueryParam(index, 'value', e.target.value)} placeholder="值" spellCheck={false} />
                <button className="remove-button" onClick={() => removeQueryParam(key)}><i className="ri-delete-bin-line" /></button>
              </div>
            ))}
            {queryEntries.length === 0 && <div className="key-value-empty">暂无查询参数</div>}
          </div>
        </div>
      )}

      {activeTab === 'headers' && (
        <div className="headers-editor">
          <div className="key-value-editor">
            <div className="key-value-header">
              <span>请求头</span>
              <button className="add-button" onClick={addHeader}><i className="ri-add-line" /> 添加</button>
            </div>
            {headerEntries.map(([key, value], index) => (
              <div key={index} className="key-value-row">
                <input className="kv-key" type="text" value={key} onChange={(e) => updateHeader(index, 'key', e.target.value)} placeholder="请求头名称" spellCheck={false} />
                <input className="kv-value" type="text" value={value} onChange={(e) => updateHeader(index, 'value', e.target.value)} placeholder="值" spellCheck={false} />
                <button className="remove-button" onClick={() => removeHeader(key)}><i className="ri-delete-bin-line" /></button>
              </div>
            ))}
            {headerEntries.length === 0 && <div className="key-value-empty">暂无请求头</div>}
          </div>
        </div>
      )}

      {activeTab === 'body' && (
        <div className="body-editor">
          <div className="body-type-selector">
            {BODY_TYPES.map((type) => (
              <button
                key={type}
                className={`body-type-button ${request.body?.type === type || (!request.body && type === 'none') ? 'active' : ''}`}
                onClick={() => {
                  if (type === 'none') updateBody(undefined);
                  else if (type === 'json') updateBody({ type: 'json', content: '{\n  \n}' } as any);
                  else if (type === 'form-data') updateBody({ type: 'form-data', content: [] } as any);
                  else if (type === 'x-www-form-urlencoded') updateBody({ type: 'x-www-form-urlencoded', content: '' } as any);
                  else if (type === 'raw') updateBody({ type: 'raw', content: '' } as any);
                  else if (type === 'binary') updateBody({ type: 'binary', content: '', filename: '' } as any);
                  else if (type === 'graphql') updateBody({ type: 'graphql', content: '{\n  \n}' } as any);
                }}
              >
                {BODY_TYPE_LABELS[type] ?? type}
              </button>
            ))}
          </div>

          {(!request.body || request.body.type === 'none') && <div className="body-empty">此请求没有请求体</div>}

          {request.body?.type === 'json' && (
            <textarea className="body-textarea code" value={request.body.content} onChange={(e) => updateBody({ type: 'json', content: e.target.value } as any)} placeholder="输入 JSON 请求体" spellCheck={false} />
          )}
          {request.body?.type === 'raw' && (
            <textarea className="body-textarea" value={request.body.content} onChange={(e) => updateBody({ type: 'raw', content: e.target.value } as any)} placeholder="输入原始请求体" spellCheck={false} />
          )}
          {request.body?.type === 'graphql' && (
            <textarea className="body-textarea code" value={request.body.content} onChange={(e) => updateBody({ type: 'graphql', content: e.target.value } as any)} placeholder="输入 GraphQL 查询" spellCheck={false} />
          )}
          {request.body?.type === 'x-www-form-urlencoded' && (
            <textarea className="body-textarea" value={request.body.content} onChange={(e) => updateBody({ type: 'x-www-form-urlencoded', content: e.target.value } as any)} placeholder="键1=值1&键2=值2" spellCheck={false} />
          )}
          {request.body?.type === 'form-data' && (
            <div className="form-data-editor">
              <button className="add-button" onClick={() => { const fields = [...(request.body!.content as FormDataField[]), { name: '', value: '' }]; updateBody({ type: 'form-data', content: fields } as any); }}>
                <i className="ri-add-line" /> 添加字段
              </button>
              {(request.body.content as FormDataField[]).map((field, index) => (
                <div key={index} className="key-value-row">
                  <input className="kv-key" type="text" value={field.name} onChange={(e) => { const fields = [...(request.body!.content as FormDataField[])]; fields[index] = { ...fields[index]!, name: e.target.value }; updateBody({ type: 'form-data', content: fields } as any); }} placeholder="字段名" spellCheck={false} />
                  <input className="kv-value" type="text" value={field.value} onChange={(e) => { const fields = [...(request.body!.content as FormDataField[])]; fields[index] = { ...fields[index]!, value: e.target.value }; updateBody({ type: 'form-data', content: fields } as any); }} placeholder="值" spellCheck={false} />
                  <button className="remove-button" onClick={() => { const fields = (request.body!.content as FormDataField[]).filter((_, i) => i !== index); updateBody({ type: 'form-data', content: fields } as any); }}><i className="ri-delete-bin-line" /></button>
                </div>
              ))}
            </div>
          )}
          {request.body?.type === 'binary' && (
            <div className="binary-editor">
              <input className="binary-filename" type="text" value={request.body.filename ?? ''} onChange={(e) => updateBody({ type: 'binary', content: request.body!.content, filename: e.target.value } as any)} placeholder="文件路径" spellCheck={false} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
