import React from 'react';
import { Environment } from '../../types/api';
import './EnvironmentSelector.css';

interface EnvironmentSelectorProps {
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSwitchEnvironment: (environmentId: string | null) => void;
  onUpdateVariable: (environmentId: string, variable: any) => void;
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  environments, activeEnvironmentId, onSwitchEnvironment, onUpdateVariable: _onUpdateVariable,
}) => {
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId) ?? null;

  return (
    <div className="environment-selector">
      <div className="env-header"><span>环境</span></div>
      <select className="env-dropdown" value={activeEnvironmentId ?? ''} onChange={(e) => onSwitchEnvironment(e.target.value || null)}>
        <option value="">无环境</option>
        {environments.map((env) => (<option key={env.id} value={env.id}>{env.name}</option>))}
      </select>
      {activeEnv && (
        <div className="env-variables">
          <div className="env-var-header">
            <span>{activeEnv.name}</span>
            <span className="var-count">{activeEnv.variables.length} 个变量</span>
          </div>
          {activeEnv.variables.map((v, index) => (
            <div key={index} className="env-var-row">
              <span className="env-var-key">{v.key}</span>
              <span className="env-var-value">{v.type === 'secret' ? '••••••••' : v.value}</span>
            </div>
          ))}
          {activeEnv.variables.length === 0 && <div className="empty-message">暂无变量</div>}
        </div>
      )}
      {environments.length === 0 && <div className="empty-message">暂无环境，请从命令面板创建</div>}
    </div>
  );
};
