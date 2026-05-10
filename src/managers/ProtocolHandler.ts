/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-base-to-string */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { HttpRequest, HttpResponse } from './RequestManager';
import WebSocket from 'ws';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';

export interface ProtocolHandler {
  sendRequest(request: HttpRequest): Promise<HttpResponse>;
}

export interface GrpcRequest extends Omit<HttpRequest, 'method'> {
  protoFile: string;
  service: string;
  grpcMethod: string;
  message: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface ProtoDefinition {
  package: string;
  services: Map<string, grpc.GrpcObject>;
  definition: protoLoader.PackageDefinition;
}

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

type StreamMessageType = 'data' | 'end' | 'error';

export interface StreamMessage {
  type: StreamMessageType;
  data?: string;
  error?: string;
  timestamp: number;
}

export class HttpProtocolHandler implements ProtocolHandler {
  async sendRequest(request: HttpRequest): Promise<HttpResponse> {
    const { executeHttpRequest } = await import('./RequestManager');
    return executeHttpRequest(request);
  }
}

export class GrpcProtocolHandler implements ProtocolHandler {
  private protoDefinitions: Map<string, ProtoDefinition> = new Map();
  private clients: Map<string, grpc.Client> = new Map();

  async loadProtoFile(filePath: string): Promise<ProtoDefinition> {
    const cached = this.protoDefinitions.get(filePath);
    if (cached) {
      return cached;
    }

    const packageDefinition = await protoLoader.load(filePath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);
    const packageName = this._detectPackageName(packageDefinition);
    const services = this._extractServices(grpcObject, packageName);

    const protoDef: ProtoDefinition = {
      package: packageName,
      services,
      definition: packageDefinition,
    };

    this.protoDefinitions.set(filePath, protoDef);
    return protoDef;
  }

  async sendRequest(request: HttpRequest): Promise<HttpResponse> {
    const grpcReq = request as unknown as GrpcRequest;
    const startTime = Date.now();

    if (!grpcReq.protoFile || !grpcReq.service || !grpcReq.grpcMethod) {
      throw new Error('gRPC request requires protoFile, service, and grpcMethod fields');
    }

    const protoDef = await this.loadProtoFile(grpcReq.protoFile);
    const parsedUrl = new url.URL(request.url);
    const target = `${parsedUrl.hostname}:${parsedUrl.port || 50051}`;

    const ServiceConstructor = this._getServiceConstructor(protoDef, grpcReq.service);
    if (!ServiceConstructor) {
      throw new Error(`Service "${grpcReq.service}" not found in proto definition`);
    }

    const metadata = new grpc.Metadata();
    if (grpcReq.metadata) {
      for (const [key, value] of Object.entries(grpcReq.metadata)) {
        metadata.add(key, value);
      }
    }
    for (const [key, value] of Object.entries(request.headers)) {
      metadata.add(key, value);
    }

    return new Promise<HttpResponse>((resolve, reject) => {
      const ServiceCtor = ServiceConstructor as unknown as typeof grpc.Client;
      const client = new ServiceCtor(
        target,
        grpc.credentials.createInsecure(),
      );

      const method = (client as any)[grpcReq.grpcMethod];
      if (!method || typeof method !== 'function') {
        client.close();
        reject(new Error(`Method "${grpcReq.grpcMethod}" not found on service`));
        return;
      }

      method.call(
        client,
        grpcReq.message ?? {},
        metadata,
        (err: grpc.ServiceError | null, response: any) => {
          const elapsed = Date.now() - startTime;
          client.close();

          if (err) {
            resolve({
              status: err.code ?? grpc.status.INTERNAL,
              statusText: err.message ?? 'gRPC Error',
              headers: {},
              body: JSON.stringify({ error: err.message, code: err.code, details: err.details }),
              time: elapsed,
              size: Buffer.byteLength(err.message ?? ''),
              cookies: [],
            });
            return;
          }

          const bodyStr = JSON.stringify(response, null, 2);
          resolve({
            status: grpc.status.OK,
            statusText: 'OK',
            headers: { 'content-type': 'application/grpc' },
            body: bodyStr,
            time: elapsed,
            size: Buffer.byteLength(bodyStr),
            cookies: [],
          });
        },
      );
    });
  }

  async getServiceMethods(protoFile: string, serviceName: string): Promise<string[]> {
    const protoDef = await this.loadProtoFile(protoFile);
    const ServiceConstructor = this._getServiceConstructor(protoDef, serviceName);
    if (!ServiceConstructor) {
      return [];
    }
    const methods: string[] = [];
    const proto = (ServiceConstructor as any).service?.prototype ?? (ServiceConstructor as any).service;
    if (proto && typeof proto === 'object') {
      for (const key of Object.keys(proto)) {
        methods.push(key);
      }
    }
    return methods;
  }

  private _detectPackageName(packageDefinition: protoLoader.PackageDefinition): string {
    const firstKey = Object.keys(packageDefinition)[0];
    if (!firstKey) return '';
    const dotIndex = firstKey.lastIndexOf('.');
    return dotIndex > 0 ? firstKey.substring(0, dotIndex) : '';
  }

  private _extractServices(grpcObject: grpc.GrpcObject, _packageName: string): Map<string, grpc.GrpcObject> {
    const services = new Map<string, grpc.GrpcObject>();
    const traverse = (obj: grpc.GrpcObject, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullName = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'function' && (value as any).service) {
          services.set(fullName, value as unknown as grpc.GrpcObject);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          traverse(value as grpc.GrpcObject, fullName);
        }
      }
    };
    traverse(grpcObject);
    return services;
  }

  private _getServiceConstructor(protoDef: ProtoDefinition, serviceName: string): grpc.GrpcObject | null {
    const service = protoDef.services.get(serviceName);
    return service ?? null;
  }

  dispose(): void {
    for (const client of this.clients.values()) {
      (client as any).close?.();
    }
    this.clients.clear();
    this.protoDefinitions.clear();
  }
}

export class WebSocketHandler {
  private connections: Map<string, WebSocket> = new Map();
  private messageCallbacks: Map<string, Array<(msg: StreamMessage) => void>> = new Map();
  private nextId = 1;

  async connect(targetUrl: string, protocols?: string[], headers?: Record<string, string>): Promise<string> {
    const connectionId = String(this.nextId++);

    const wsOptions: WebSocket.ClientOptions = {};
    if (headers) {
      wsOptions.headers = headers;
    }

    const ws = protocols && protocols.length > 0
      ? new WebSocket(targetUrl, protocols, wsOptions)
      : new WebSocket(targetUrl, wsOptions);

    return new Promise<string>((resolve, reject) => {
      ws.on('open', () => {
        this.connections.set(connectionId, ws);
        resolve(connectionId);
      });

      ws.on('message', (data: WebSocket.Data) => {
        const message: StreamMessage = {
          type: 'data',
          data: typeof data === 'string' ? data : data.toString('utf-8'),
          timestamp: Date.now(),
        };
        this._notifyCallbacks(connectionId, message);
      });

      ws.on('close', () => {
        this._notifyCallbacks(connectionId, {
          type: 'end',
          timestamp: Date.now(),
        });
        this.connections.delete(connectionId);
        this.messageCallbacks.delete(connectionId);
      });

      ws.on('error', (err: Error) => {
        this._notifyCallbacks(connectionId, {
          type: 'error',
          error: err.message,
          timestamp: Date.now(),
        });
        if (!this.connections.has(connectionId)) {
          reject(err);
        }
      });
    });
  }

  sendMessage(connectionId: string, message: string | Buffer): void {
    const ws = this.connections.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket connection "${connectionId}" not found or not open`);
    }
    ws.send(message);
  }

  onMessage(connectionId: string, callback: (msg: StreamMessage) => void): () => void {
    if (!this.messageCallbacks.has(connectionId)) {
      this.messageCallbacks.set(connectionId, []);
    }
    this.messageCallbacks.get(connectionId)!.push(callback);
    return () => {
      const callbacks = this.messageCallbacks.get(connectionId);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) callbacks.splice(idx, 1);
      }
    };
  }

  disconnect(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close();
      this.connections.delete(connectionId);
      this.messageCallbacks.delete(connectionId);
    }
  }

  getConnectionState(connectionId: string): 'connecting' | 'open' | 'closing' | 'closed' | 'unknown' {
    const ws = this.connections.get(connectionId);
    if (!ws) return 'unknown';
    switch (ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }

  private _notifyCallbacks(connectionId: string, message: StreamMessage): void {
    const callbacks = this.messageCallbacks.get(connectionId);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(message); } catch { /* swallow */ }
      }
    }
  }

  dispose(): void {
    for (const ws of this.connections.values()) {
      ws.close();
    }
    this.connections.clear();
    this.messageCallbacks.clear();
  }
}

export class SSEHandler {
  private connections: Map<string, http.ClientRequest> = new Map();
  private eventCallbacks: Map<string, Array<(event: SSEEvent) => void>> = new Map();
  private nextId = 1;

  async connect(targetUrl: string, headers?: Record<string, string>): Promise<string> {
    const connectionId = String(this.nextId++);
    const parsedUrl = new url.URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...headers,
      },
    };

    return new Promise<string>((resolve, reject) => {
      const req = transport.request(options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`SSE connection failed with status ${res.statusCode}`));
          return;
        }

        this.connections.set(connectionId, req);
        resolve(connectionId);

        let buffer = '';

        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent: SSEEvent | null = null;

          for (const line of lines) {
            if (line.startsWith('event:')) {
              if (!currentEvent) currentEvent = { data: '' };
              currentEvent.event = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              if (!currentEvent) currentEvent = { data: '' };
              currentEvent.data = currentEvent.data
                ? currentEvent.data + '\n' + line.substring(5).trim()
                : line.substring(5).trim();
            } else if (line.startsWith('id:')) {
              if (!currentEvent) currentEvent = { data: '' };
              currentEvent.id = line.substring(3).trim();
            } else if (line.startsWith('retry:')) {
              if (!currentEvent) currentEvent = { data: '' };
              const retryVal = parseInt(line.substring(6).trim(), 10);
              if (!isNaN(retryVal)) currentEvent.retry = retryVal;
            } else if (line === '') {
              if (currentEvent) {
                this._notifyEventCallbacks(connectionId, currentEvent);
                currentEvent = null;
              }
            }
          }
        });

        res.on('error', (err: Error) => {
          this._notifyEventCallbacks(connectionId, {
            event: 'error',
            data: err.message,
          });
        });

        res.on('end', () => {
          this.connections.delete(connectionId);
          this.eventCallbacks.delete(connectionId);
        });
      });

      req.on('error', (err: Error) => {
        if (!this.connections.has(connectionId)) {
          reject(err);
        }
      });

      req.end();
    });
  }

  onEvent(connectionId: string, callback: (event: SSEEvent) => void): () => void {
    if (!this.eventCallbacks.has(connectionId)) {
      this.eventCallbacks.set(connectionId, []);
    }
    this.eventCallbacks.get(connectionId)!.push(callback);
    return () => {
      const callbacks = this.eventCallbacks.get(connectionId);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) callbacks.splice(idx, 1);
      }
    };
  }

  disconnect(connectionId: string): void {
    const req = this.connections.get(connectionId);
    if (req) {
      req.destroy();
      this.connections.delete(connectionId);
      this.eventCallbacks.delete(connectionId);
    }
  }

  private _notifyEventCallbacks(connectionId: string, event: SSEEvent): void {
    const callbacks = this.eventCallbacks.get(connectionId);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(event); } catch { /* swallow */ }
      }
    }
  }

  dispose(): void {
    for (const req of this.connections.values()) {
      req.destroy();
    }
    this.connections.clear();
    this.eventCallbacks.clear();
  }
}
