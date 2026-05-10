import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'high-contrast';

/**
 * Hook to detect and respond to VS Code theme changes
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => {
    // Detect initial theme from body class
    if (document.body.classList.contains('vscode-light')) {
      return 'light';
    } else if (document.body.classList.contains('vscode-high-contrast')) {
      return 'high-contrast';
    }
    return 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains('vscode-light')) {
        setTheme('light');
      } else if (document.body.classList.contains('vscode-high-contrast')) {
        setTheme('high-contrast');
      } else {
        setTheme('dark');
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}
