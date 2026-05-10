import React, { useState } from 'react';
import { Environment } from '../../types/api';
import './EnvironmentManager.css';

interface EnvironmentManagerProps {
  environments: Environment[];
  activeEnvironmentId: string | null;
  onUpdateVariable: (environmentId: string, variable: any) => void;
  onSwitchEnvironment: (environmentId: string | null) => void;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({
  environments, activeEnvironmentId, onUpdateVariable, onSwitchEnvironment,
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(activeEnvironmentId);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const selectedEnv = environments.find((e) => e.id === selectedEnvId) ?? null;

  const handleAddVariable = () => {
    if (!selectedEnvId || !newVarKey.trim()) return;
    onUpdateVariable(selectedEnvId, { key: newVarKey.trim(), value: newVarValue, type: 'default', enabled: true });
    setNewVarKey('');
    setNewVarValue('');
  };

  const handleUpdateVariable = (index: number, field: string, value: any) => {
    if (!selectedEnvId || !selectedEnv) return;
    const vars = [...selectedEnv.variables];
    vars[index] = { ...vars[index]!, [field]: value };
    for (const v of vars) { onUpdateVariable(selectedEnvId, v); }
  };

  const handleDeleteVariable = (index: number) => {
    if (!selectedEnvId || !selectedEnv) return;
    const vars = selectedEnv.variables.filter((_, i) => i !== index);
    onUpdateVariable(selectedEnvId, { replace: true, variables: vars });
  };

  return (
    <div className="environment-manager">
      <div className="env-manager-header"><h2>环境管理</h2></div>
      <div className="env-manager-content">
        <div className="env-list">
          <h3>环境列表</h3>
          {environments.map((env) => (
            <div key={env.id} className={`env-item ${selectedEnvId === env.id ? 'active' : ''}`} onClick={() => { setSelectedEnvId(env.id); onSwitchEnvironment(env.id); }}>
              <i className="ri-earth-line" /><span>{env.name}</span><span className="var-count">{env.variables.length}</span>
            </div>
          ))}
          {environments.length === 0 && <div className="empty-message">暂无环境，请从命令面板创建</div>}
        </div>
        {selectedEnv && (
          <div className="env-detail">
            <h3>{selectedEnv.name}</h3>
            <div className="add-variable-row">
              <input type="text" value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="变量名" spellCheck={false} />
              <input type="text" value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} placeholder="值" spellCheck={false} />
              <button onClick={handleAddVariable} disabled={!newVarKey.trim()}><i className="ri-add-line" /> 添加</button>
            </div>
            <div className="variable-list">
              {selectedEnv.variables.map((v, index) => (
                <div key={index} className="variable-row">
                  <input className="checkbox" type="checkbox" checked={v.enabled} onChange={(e) => handleUpdateVariable(index, 'enabled', e.target.checked)} />
                  <input className="var-key" type="text" value={v.key} onChange={(e) => handleUpdateVariable(index, 'key', e.target.value)} spellCheck={false} />
                  <input className="var-value" type={v.type === 'secret' ? 'password' : 'text'} value={v.value} onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)} spellCheck={false} />
                  <select className="var-type" value={v.type} onChange={(e) => handleUpdateVariable(index, 'type', e.target.value)}>
                    <option value="default">默认</option>
                    <option value="secret">密钥</option>
                  </select>
                  <button className="remove-button" onClick={() => handleDeleteVariable(index)}><i className="ri-delete-bin-line" /></button>
                </div>
              ))}
              {selectedEnv.variables.length === 0 && <div className="empty-message">此环境暂无变量</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
