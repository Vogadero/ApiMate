import * as http from 'http';

export interface MockEndpoint {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  delay: number;
  enabled: boolean;
}

export class MockServer {
  private server: http.Server | null = null;
  private endpoints: Map<string, MockEndpoint> = new Map();
  private port: number;
  private nextId = 1;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(port: number = 4010) {
    this.port = port;
  }

  addEndpoint(endpoint: Omit<MockEndpoint, 'id'>): MockEndpoint {
    const id = String(this.nextId++);
    const mock: MockEndpoint = { id, ...endpoint };
    this.endpoints.set(id, mock);
    return mock;
  }

  removeEndpoint(id: string): void {
    this.endpoints.delete(id);
  }

  updateEndpoint(id: string, updates: Partial<MockEndpoint>): void {
    const existing = this.endpoints.get(id);
    if (existing) {
      this.endpoints.set(id, { ...existing, ...updates });
    }
  }

  getEndpoints(): MockEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = http.createServer((req, res) => {
      const endpoint = this._matchEndpoint(req.method ?? 'GET', req.url ?? '/');
      if (!endpoint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No matching mock endpoint', path: req.url }));
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
        ...endpoint.headers,
      };

      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
      }

      const timer = setTimeout(() => {
        res.writeHead(endpoint.statusCode, headers);
        res.end(endpoint.body);
      }, endpoint.delay);
      this.disposables.push({ dispose: () => clearTimeout(timer) });
    });

    await new Promise<void>((resolve, reject) => {
      const srv = this.server!;
      srv.listen(this.port, () => {
        resolve();
      });
      srv.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const srv = this.server;
    await new Promise<void>((resolve, reject) => {
      srv.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        this.server = null;
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://localhost:${String(this.port)}`;
  }

  private _matchEndpoint(method: string, url: string): MockEndpoint | null {
    const pathOnly = url.split('?')[0] ?? url;

    for (const endpoint of this.endpoints.values()) {
      if (!endpoint.enabled) {
        continue;
      }

      if (endpoint.method.toUpperCase() === method.toUpperCase()) {
        if (this._pathMatches(endpoint.path, pathOnly)) {
          return endpoint;
        }
      }
    }

    return null;
  }

  private _pathMatches(pattern: string, path: string): boolean {
    if (pattern === path) {
      return true;
    }

    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i]!;
      const pathP = pathParts[i]!;

      if (pp.startsWith(':') || pp.startsWith('{')) {
        continue;
      }
      if (pp !== pathP) {
        return false;
      }
    }

    return true;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.endpoints.clear();
  }
}
