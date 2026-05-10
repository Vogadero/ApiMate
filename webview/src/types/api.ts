export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE' | 'PROPFIND' | 'CUSTOM';

export interface HttpRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body?: RequestBody;
  auth?: AuthConfig;
  preRequestScript?: string;
  postRequestScript?: string;
  createdAt?: number;
  pinned?: boolean;
}

export type RequestBody =
  | { type: 'json'; content: string }
  | { type: 'form-data'; content: FormDataField[] }
  | { type: 'x-www-form-urlencoded'; content: string }
  | { type: 'raw'; content: string }
  | { type: 'binary'; content: string; filename?: string }
  | { type: 'graphql'; content: string }
  | { type: 'none'; content?: undefined };

export interface FormDataField {
  name: string;
  value: string;
  filename?: string;
  contentType?: string;
  enabled?: boolean;
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'ntlm' | 'aws-sigv4';
  config: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
  cookies: Cookie[];
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  folders: Folder[];
  requests: HttpRequest[];
  variables: Variable[];
  auth?: AuthConfig;
  preRequestScript?: string;
  postRequestScript?: string;
}

export interface Folder {
  id: string;
  name: string;
  folders: Folder[];
  requests: HttpRequest[];
  auth?: AuthConfig;
}

export interface Variable {
  key: string;
  value: string;
  type: 'default' | 'secret';
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: Variable[];
}

export interface HistoryEntry {
  id: string;
  request: HttpRequest;
  response: HttpResponse;
  timestamp: number;
  name?: string;
  pinned?: boolean;
}

export interface WebviewMessage {
  type: string;
  payload?: any;
}

export interface ExtensionMessage {
  type: string;
  payload?: any;
}

export type RequestBodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'var(--method-get)',
  POST: 'var(--method-post)',
  PUT: 'var(--method-put)',
  DELETE: 'var(--method-delete)',
  PATCH: 'var(--method-patch)',
  HEAD: 'var(--method-head)',
  OPTIONS: 'var(--method-options)',
  CONNECT: 'var(--method-post)',
  TRACE: 'var(--method-options)',
  PROPFIND: 'var(--method-head)',
  CUSTOM: 'var(--method-patch)',
};

export const METHOD_RAW_COLORS: Record<HttpMethod, string> = {
  GET: '#4ec9b0',
  POST: '#dcdcaa',
  PUT: '#569cd6',
  DELETE: '#f14c4c',
  PATCH: '#c586c0',
  HEAD: '#9cdcfe',
  OPTIONS: '#ce9178',
  CONNECT: '#dcdcaa',
  TRACE: '#d4d4d4',
  PROPFIND: '#b5cea8',
  CUSTOM: '#c586c0',
};

export const STATUS_CODE_COLORS: Record<string, string> = {
  '2': 'var(--status-2xx)',
  '3': 'var(--status-3xx)',
  '4': 'var(--status-4xx)',
  '5': 'var(--status-5xx)',
};

export function getStatusColor(status: number): string {
  const firstChar = String(status).charAt(0);
  return STATUS_CODE_COLORS[firstChar] ?? '#999';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export function detectContentType(body: string): string {
  try {
    JSON.parse(body);
    return 'json';
  } catch { /* not json */ }
  if (body.trim().startsWith('<')) return 'xml';
  return 'text';
}
