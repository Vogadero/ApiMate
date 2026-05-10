import React, { useState } from 'react';
import './ScriptEditor.css';

interface ScriptEditorProps {
  preRequestScript?: string;
  postRequestScript?: string;
  onPreRequestScriptChange: (script: string) => void;
  onPostRequestScriptChange: (script: string) => void;
}

type ScriptTab = 'pre-request' | 'post-request';

const PRE_REQUEST_HELP = `// 前置脚本
// 可用对象: pm.environment, pm.variables, pm.request
pm.request.headers.add({ key: 'X-Timestamp', value: Date.now().toString() });`;

const POST_REQUEST_HELP = `// 后置脚本 / 测试
// 可用对象: pm.response, pm.test, pm.expect (Chai.js)
pm.test('状态码为 200', () => {
  pm.expect(pm.response.status).to.equal(200);
});`;

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  preRequestScript, postRequestScript, onPreRequestScriptChange, onPostRequestScriptChange,
}) => {
  const [activeTab, setActiveTab] = useState<ScriptTab>('pre-request');

  return (
    <div className="script-editor">
      <div className="script-tabs">
        <button className={`script-tab ${activeTab === 'pre-request' ? 'active' : ''}`} onClick={() => setActiveTab('pre-request')}>前置脚本</button>
        <button className={`script-tab ${activeTab === 'post-request' ? 'active' : ''}`} onClick={() => setActiveTab('post-request')}>后置脚本 / 测试</button>
      </div>
      <div className="script-content">
        {activeTab === 'pre-request' && (
          <>
            <div className="script-help">{PRE_REQUEST_HELP}</div>
            <textarea className="script-textarea" value={preRequestScript ?? ''} onChange={(e) => onPreRequestScriptChange(e.target.value)} placeholder="// 在此编写前置脚本" spellCheck={false} />
          </>
        )}
        {activeTab === 'post-request' && (
          <>
            <div className="script-help">{POST_REQUEST_HELP}</div>
            <textarea className="script-textarea" value={postRequestScript ?? ''} onChange={(e) => onPostRequestScriptChange(e.target.value)} placeholder="// 在此编写测试脚本" spellCheck={false} />
          </>
        )}
      </div>
    </div>
  );
};
