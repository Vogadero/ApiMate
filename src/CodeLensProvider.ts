import * as vscode from 'vscode';

interface RoutePattern {
  pattern: RegExp;
  methodGroup: number;
  pathGroup: number;
}

const ROUTE_PATTERNS: RoutePattern[] = [
  { pattern: /app\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"` ]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
  { pattern: /router\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"` ]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
  { pattern: /@(Get|Post|Put|Delete|Patch|Head|Options|All)\s*\(\s*['"`]([^'"` ]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
  { pattern: /@app\.route\s*\(\s*['"`]([^'"` ]+)['"`]\s*,\s*methods\s*=\s*\[(['"`]\w+['"`])/g, methodGroup: 2, pathGroup: 1 },
  { pattern: /@RequestMapping\s*\(\s*(?:value\s*=\s*)?['"`]([^'"` ]+)['"`]/g, methodGroup: 0, pathGroup: 1 },
  { pattern: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*(?:value\s*=\s*)?['"`]([^'"` ]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
];

function extractRoutes(text: string, lineCount: number): { line: number; method: string; path: string }[] {
  const routes: { line: number; method: string; path: string }[] = [];
  const lines = text.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;

    for (const rp of ROUTE_PATTERNS) {
      const regex = new RegExp(rp.pattern.source, rp.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        let method = match[rp.methodGroup]?.toUpperCase() ?? 'GET';
        const path = match[rp.pathGroup] ?? '/';

        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method)) {
          routes.push({ line: lineIdx, method, path });
        } else if (rp.methodGroup === 0) {
          routes.push({ line: lineIdx, method: 'GET', path });
        }

        method = method.replace(/['"`]/g, '');
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method)) {
          routes.push({ line: lineIdx, method, path });
        }
      }
    }
  }

  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.line}:${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class ApiMateCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  get onDidChangeCodeLenses(): vscode.Event<void> {
    return this._onDidChangeCodeLenses.event;
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const enabled = vscode.workspace.getConfiguration('apimate').get<boolean>('enableCodeLens') ?? true;
    if (!enabled) return [];

    const text = document.getText();
    const routes = extractRoutes(text, document.lineCount);
    const lenses: vscode.CodeLens[] = [];

    for (const route of routes) {
      const range = new vscode.Range(route.line, 0, route.line, 0);

      lenses.push(new vscode.CodeLens(range, {
        title: `$(play) 测试 ${route.method} ${route.path}`,
        command: 'apimate.testApi',
        arguments: [route.path, route.method],
      }));
    }

    return lenses;
  }

  resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens {
    return codeLens;
  }
}
