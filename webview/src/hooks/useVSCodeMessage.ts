import { useEffect, useCallback } from 'react';
import { vscode } from '../utils/vscode';
import { WebviewMessage } from '../types/messages';

/**
 * Hook for sending and receiving messages from the VS Code extension
 */
export function useVSCodeMessage(
  onMessage: (message: WebviewMessage) => void
) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as WebviewMessage;
      onMessage(message);
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onMessage]);

  const sendMessage = useCallback((message: WebviewMessage) => {
    vscode.postMessage(message);
  }, []);

  return { sendMessage };
}
