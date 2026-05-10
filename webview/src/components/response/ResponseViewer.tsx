import React, { useState, useMemo } from 'react';
import { HttpResponse, getStatusColor, formatBytes, formatTime, tryFormatJson, detectContentType } from '../../types/api';
import { CookieViewer } from './CookieViewer';
import './ResponseViewer.css';

interface ResponseViewerProps {
  response: HttpResponse;
  error?: string | null;
}

type ResponseTab = 'body' | 'headers' | 'cookies';

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, error }) => {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [bodyFormat, setBodyFormat] = useState<'pretty' | 'raw' | 'preview'>('pretty');

  const statusColor = getStatusColor(response.status);
  const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? '';
  const detectedType = detectContentType(response.body);

  const formattedBody = useMemo(() => {
    if (bodyFormat === 'raw') return response.body;
    if (bodyFormat === 'pretty' && (detectedType === 'json' || contentType.includes('json'))) {
      return tryFormatJson(response.body);
    }
    return response.body;
  }, [response.body, bodyFormat, detectedType, contentType]);

  const headerEntries = Object.entries(response.headers);

  return (
    <div className="response-viewer">
      <div className="response-summary">
        <span className="status-badge" style={{ backgroundColor: statusColor }}>
          {response.status} {response.statusText}
        </span>
        <span className="response-meta"><i className="ri-timer-line" /> {formatTime(response.time)}</span>
        <span className="response-meta"><i className="ri-file-size-line" /> {formatBytes(response.size)}</span>
        {error && <span className="response-error">{error}</span>}
      </div>

      <div className="response-tabs">
        <button className={`response-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>响应体</button>
        <button className={`response-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
          响应头 {headerEntries.length > 0 && <span className="tab-badge">{headerEntries.length}</span>}
        </button>
        <button className={`response-tab ${activeTab === 'cookies' ? 'active' : ''}`} onClick={() => setActiveTab('cookies')}>
          Cookie {response.cookies.length > 0 && <span className="tab-badge">{response.cookies.length}</span>}
        </button>
      </div>

      <div className="response-tab-content">
        {activeTab === 'body' && (
          <div className="response-body">
            <div className="body-format-bar">
              <button className={`format-button ${bodyFormat === 'pretty' ? 'active' : ''}`} onClick={() => setBodyFormat('pretty')}>格式化</button>
              <button className={`format-button ${bodyFormat === 'raw' ? 'active' : ''}`} onClick={() => setBodyFormat('raw')}>原始</button>
              <button className={`format-button ${bodyFormat === 'preview' ? 'active' : ''}`} onClick={() => setBodyFormat('preview')}>预览</button>
              <button className="copy-button" onClick={() => navigator.clipboard.writeText(response.body)} title="复制响应体">
                <i className="ri-file-copy-line" /> 复制
              </button>
            </div>
            {bodyFormat === 'preview' && contentType.includes('text/html') ? (
              <iframe className="response-preview" srcDoc={response.body} sandbox="allow-same-origin" title="响应预览" />
            ) : (
              <pre className={`response-body-content ${detectedType}`}><code>{formattedBody}</code></pre>
            )}
          </div>
        )}
        {activeTab === 'headers' && (
          <div className="response-headers">
            {headerEntries.map(([key, value]) => (
              <div key={key} className="header-row">
                <span className="header-key">{key}</span>
                <span className="header-value">{value}</span>
              </div>
            ))}
            {headerEntries.length === 0 && <div className="empty-message">暂无响应头</div>}
          </div>
        )}
        {activeTab === 'cookies' && <CookieViewer cookies={response.cookies} />}
      </div>
    </div>
  );
};
