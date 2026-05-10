import React from 'react';
import { AuthConfig } from '../../types/api';
import './AuthEditor.css';

interface AuthEditorProps {
  auth?: AuthConfig;
  onAuthChange: (auth: AuthConfig) => void;
}

const AUTH_TYPES = [
  { value: 'none', label: '无认证' },
  { value: 'basic', label: '基本认证' },
  { value: 'bearer', label: 'Bearer 令牌' },
  { value: 'api-key', label: 'API 密钥' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'aws-sigv4', label: 'AWS 签名 V4' },
] as const;

export const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onAuthChange }) => {
  const currentType = auth?.type ?? 'none';

  const handleTypeChange = (type: string) => {
    switch (type) {
      case 'none': onAuthChange({ type: 'none', config: {} }); break;
      case 'basic': onAuthChange({ type: 'basic', config: { username: '', password: '' } }); break;
      case 'bearer': onAuthChange({ type: 'bearer', config: { token: '' } }); break;
      case 'api-key': onAuthChange({ type: 'api-key', config: { key: '', value: '', addTo: 'header' } }); break;
      case 'oauth2': onAuthChange({ type: 'oauth2', config: { grantType: 'authorization_code', accessTokenUrl: '', authorizationUrl: '', clientId: '', clientSecret: '', scope: '' } }); break;
      case 'aws-sigv4': onAuthChange({ type: 'aws-sigv4', config: { accessKey: '', secretKey: '', region: 'us-east-1', service: '' } }); break;
    }
  };

  const updateConfig = (key: string, value: string) => {
    if (!auth) return;
    onAuthChange({ ...auth, config: { ...auth.config, [key]: value } });
  };

  return (
    <div className="auth-editor">
      <div className="auth-type-selector">
        <label>类型</label>
        <select value={currentType} onChange={(e) => handleTypeChange(e.target.value)}>
          {AUTH_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
      </div>

      {currentType === 'basic' && (
        <div className="auth-fields">
          <div className="auth-field"><label>用户名</label><input type="text" value={auth?.config.username ?? ''} onChange={(e) => updateConfig('username', e.target.value)} placeholder="用户名" spellCheck={false} /></div>
          <div className="auth-field"><label>密码</label><input type="password" value={auth?.config.password ?? ''} onChange={(e) => updateConfig('password', e.target.value)} placeholder="密码" /></div>
        </div>
      )}
      {currentType === 'bearer' && (
        <div className="auth-fields">
          <div className="auth-field"><label>令牌</label><input type="text" value={auth?.config.token ?? ''} onChange={(e) => updateConfig('token', e.target.value)} placeholder="Bearer 令牌" spellCheck={false} /></div>
        </div>
      )}
      {currentType === 'api-key' && (
        <div className="auth-fields">
          <div className="auth-field"><label>键名</label><input type="text" value={auth?.config.key ?? ''} onChange={(e) => updateConfig('key', e.target.value)} placeholder="请求头/查询参数名" spellCheck={false} /></div>
          <div className="auth-field"><label>值</label><input type="text" value={auth?.config.value ?? ''} onChange={(e) => updateConfig('value', e.target.value)} placeholder="API 密钥值" spellCheck={false} /></div>
          <div className="auth-field"><label>添加到</label><select value={auth?.config.addTo ?? 'header'} onChange={(e) => updateConfig('addTo', e.target.value)}><option value="header">请求头</option><option value="query">查询参数</option></select></div>
        </div>
      )}
      {currentType === 'oauth2' && (
        <div className="auth-fields">
          <div className="auth-field"><label>授权类型</label><select value={auth?.config.grantType ?? 'authorization_code'} onChange={(e) => updateConfig('grantType', e.target.value)}><option value="authorization_code">授权码</option><option value="client_credentials">客户端凭证</option><option value="implicit">隐式</option><option value="password">密码</option></select></div>
          <div className="auth-field"><label>授权 URL</label><input type="text" value={auth?.config.authorizationUrl ?? ''} onChange={(e) => updateConfig('authorizationUrl', e.target.value)} placeholder="https://example.com/oauth/authorize" spellCheck={false} /></div>
          <div className="auth-field"><label>令牌 URL</label><input type="text" value={auth?.config.accessTokenUrl ?? ''} onChange={(e) => updateConfig('accessTokenUrl', e.target.value)} placeholder="https://example.com/oauth/token" spellCheck={false} /></div>
          <div className="auth-field"><label>客户端 ID</label><input type="text" value={auth?.config.clientId ?? ''} onChange={(e) => updateConfig('clientId', e.target.value)} placeholder="客户端 ID" spellCheck={false} /></div>
          <div className="auth-field"><label>客户端密钥</label><input type="password" value={auth?.config.clientSecret ?? ''} onChange={(e) => updateConfig('clientSecret', e.target.value)} placeholder="客户端密钥" /></div>
          <div className="auth-field"><label>作用域</label><input type="text" value={auth?.config.scope ?? ''} onChange={(e) => updateConfig('scope', e.target.value)} placeholder="read write" spellCheck={false} /></div>
        </div>
      )}
      {currentType === 'aws-sigv4' && (
        <div className="auth-fields">
          <div className="auth-field"><label>访问密钥</label><input type="text" value={auth?.config.accessKey ?? ''} onChange={(e) => updateConfig('accessKey', e.target.value)} placeholder="AKIAIOSFODNN7EXAMPLE" spellCheck={false} /></div>
          <div className="auth-field"><label>秘密密钥</label><input type="password" value={auth?.config.secretKey ?? ''} onChange={(e) => updateConfig('secretKey', e.target.value)} placeholder="秘密密钥" /></div>
          <div className="auth-field"><label>区域</label><input type="text" value={auth?.config.region ?? 'us-east-1'} onChange={(e) => updateConfig('region', e.target.value)} placeholder="us-east-1" spellCheck={false} /></div>
          <div className="auth-field"><label>服务</label><input type="text" value={auth?.config.service ?? ''} onChange={(e) => updateConfig('service', e.target.value)} placeholder="execute-api" spellCheck={false} /></div>
        </div>
      )}
      {currentType === 'none' && <div className="auth-empty">此请求不需要认证</div>}
    </div>
  );
};
