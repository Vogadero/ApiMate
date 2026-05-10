import React from 'react';
import { HistoryEntry, METHOD_COLORS, formatTime } from '../../types/api';
import './HistoryView.css';

interface HistoryViewProps {
  history: HistoryEntry[];
  onSelectRequest: (request: any) => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onSelectRequest, onClearHistory }) => {
  const grouped = groupByDate(history);

  return (
    <div className="history-view">
      <div className="history-header">
        <span>历史</span>
        {history.length > 0 && (
          <button className="clear-button" onClick={onClearHistory} title="清空历史"><i className="ri-delete-bin-line" /> 清空</button>
        )}
      </div>
      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date} className="history-group">
          <div className="history-date">{date}</div>
          {entries.map((entry) => (
            <div key={entry.id} className="history-item" onClick={() => onSelectRequest(entry.request)}>
              <span className="method-badge" style={{ color: METHOD_COLORS[entry.request.method] }}>{entry.request.method}</span>
              <span className="history-url">{entry.request.url || entry.request.name}</span>
              <span className="history-status" style={{ color: getStatusColor(entry.response.status) }}>{entry.response.status}</span>
              <span className="history-time">{formatTime(entry.response.time)}</span>
            </div>
          ))}
        </div>
      ))}
      {history.length === 0 && <div className="empty-message">暂无历史记录</div>}
    </div>
  );
};

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#49cc90';
  if (status >= 300 && status < 400) return '#fca130';
  if (status >= 400) return '#f93e3e';
  return '#999';
}

function groupByDate(history: HistoryEntry[]): Record<string, HistoryEntry[]> {
  const groups: Record<string, HistoryEntry[]> = {};
  for (const entry of history) {
    const date = new Date(entry.timestamp).toLocaleDateString('zh-CN');
    if (!groups[date]) groups[date] = [];
    groups[date]!.push(entry);
  }
  return groups;
}
