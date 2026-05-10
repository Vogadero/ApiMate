import React from 'react';
import { Cookie } from '../../types/api';
import './CookieViewer.css';

interface CookieViewerProps {
  cookies: Cookie[];
}

export const CookieViewer: React.FC<CookieViewerProps> = ({ cookies }) => {
  return (
    <div className="cookie-viewer">
      {cookies.map((cookie, index) => (
        <div key={index} className="cookie-row">
          <div className="cookie-main">
            <span className="cookie-name">{cookie.name}</span>
            <span className="cookie-value">{cookie.value}</span>
          </div>
          <div className="cookie-details">
            {cookie.domain && <span className="cookie-detail">域名: {cookie.domain}</span>}
            {cookie.path && <span className="cookie-detail">路径: {cookie.path}</span>}
            {cookie.expires && <span className="cookie-detail">过期: {cookie.expires}</span>}
            {cookie.httpOnly && <span className="cookie-badge">仅HTTP</span>}
            {cookie.secure && <span className="cookie-badge secure">安全</span>}
          </div>
        </div>
      ))}
      {cookies.length === 0 && <div className="empty-message">此响应中没有 Cookie</div>}
    </div>
  );
};
