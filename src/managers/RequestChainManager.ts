import { HttpResponse, HttpRequest } from './RequestManager';
import { EnvironmentManager } from './EnvironmentManager';

export interface ChainStep {
  sourceRequestId: string;
  sourcePath: string;
  targetVariable: string;
  targetScope: 'environment' | 'local';
}

export interface ChainConfig {
  steps: ChainStep[];
}

export class RequestChainManager {
  private responseCache: Map<string, HttpResponse> = new Map();

  constructor(
    private environmentManager: EnvironmentManager,
  ) {}

  cacheResponse(requestId: string, response: HttpResponse): void {
    this.responseCache.set(requestId, response);
  }

  clearCache(requestId?: string): void {
    if (requestId) {
      this.responseCache.delete(requestId);
    } else {
      this.responseCache.clear();
    }
  }

  extractValue(response: HttpResponse, path: string): string | null {
    try {
      const bodyStr = typeof response.body === 'string' ? response.body : String(response.body);
      const body: Record<string, unknown> = JSON.parse(bodyStr);
      const segments = path.split('.').filter(Boolean);
      let current: unknown = body;

      for (const segment of segments) {
        if (current === null || current === undefined) {
          return null;
        }

        const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const key = arrayMatch[1]!;
          const index = parseInt(arrayMatch[2]!, 10);
          const obj = current as Record<string, unknown>;
          const arr = obj[key] as unknown[] | undefined;
          current = arr?.[index];
        } else {
          const obj = current as Record<string, unknown>;
          current = obj[segment];
        }
      }

      if (current === null || current === undefined) {
        return null;
      }
      if (typeof current === 'object') {
        return JSON.stringify(current);
      }
      return String(current);
    } catch {
      const headerPath = path.startsWith('headers.') ? path.substring(8) : null;
      if (headerPath) {
        return response.headers[headerPath] ?? response.headers[headerPath.toLowerCase()] ?? null;
      }

      if (path === 'status') {
        return String(response.status);
      }
      if (path === 'statusText') {
        return response.statusText;
      }
      if (path === 'time') {
        return String(response.time);
      }
      if (path === 'size') {
        return String(response.size);
      }

      return null;
    }
  }

  applyChain(chain: ChainConfig, targetEnvId?: string): Map<string, string> {
    const extracted = new Map<string, string>();

    for (const step of chain.steps) {
      const response = this.responseCache.get(step.sourceRequestId);
      if (!response) {
        continue;
      }

      const value = this.extractValue(response, step.sourcePath);
      if (value === null) {
        continue;
      }

      extracted.set(step.targetVariable, value);

      if (step.targetScope === 'environment' && targetEnvId) {
        this.environmentManager.setVariable(targetEnvId, {
          key: step.targetVariable,
          value,
          type: 'default',
          enabled: true,
        });
      }
    }

    return extracted;
  }

  resolveChainedVariables(request: HttpRequest, chain: ChainConfig): HttpRequest {
    const resolved = { ...request };
    let url = resolved.url;
    let bodyStr = typeof resolved.body?.content === 'string' ? resolved.body.content : '';

    for (const step of chain.steps) {
      const response = this.responseCache.get(step.sourceRequestId);
      if (!response) {
        continue;
      }

      const value = this.extractValue(response, step.sourcePath);
      if (value === null) {
        continue;
      }

      const placeholder = `{{${step.targetVariable}}}`;
      url = url.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
      if (typeof bodyStr === 'string') {
        bodyStr = bodyStr.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
      }

      for (const [key, val] of Object.entries(resolved.headers)) {
        resolved.headers[key] = val.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
      }

      for (const [key, val] of Object.entries(resolved.queryParams)) {
        resolved.queryParams[key] = val.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
      }
    }

    resolved.url = url;
    if (resolved.body && typeof resolved.body.content === 'string') {
      resolved.body = { ...resolved.body, content: bodyStr };
    }

    return resolved;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
