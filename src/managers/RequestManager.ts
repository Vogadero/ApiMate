import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/** HTTP methods supported by ApiMate */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** Request body content types */
export type RequestBodyType =
  | 'json'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'binary'
  | 'raw'
  | 'graphql';

/** A single form-data field */
export interface FormDataField {
  name: string;
  value: string | Buffer;
  filename?: string;
  contentType?: string;
}

/** Request body */
export interface RequestBody {
  type: RequestBodyType;
  /** For json/raw/graphql/x-www-form-urlencoded: string content.
   *  For binary: Buffer.
   *  For form-data: FormDataField[]. */
  content: string | Buffer | FormDataField[];
}

/** HTTP Request model */
export interface HttpRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body?: RequestBody;
  auth?: any;
  preRequestScript?: string;
  postRequestScript?: string;
  tests?: string;
  createdAt?: number;
  pinned?: boolean;
}

/** Parsed cookie from Set-Cookie header */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: Date;
  httpOnly: boolean;
  secure: boolean;
}

/** HTTP Response model */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | Buffer;
  time: number;   // milliseconds
  size: number;   // bytes
  cookies: Cookie[];
}

// ---------------------------------------------------------------------------
// Body serialisation helpers
// ---------------------------------------------------------------------------

const BOUNDARY = '----ApiMateBoundary' + Math.random().toString(36).slice(2);

/**
 * Serialise a RequestBody into a Buffer and determine the Content-Type header.
 * Returns { buffer, contentType } or { buffer: null, contentType: '' } for
 * methods that carry no body (GET, HEAD, OPTIONS).
 */
export function serializeBody(body: RequestBody): { buffer: Buffer; contentType: string } {
  switch (body.type) {
    case 'json': {
      const text = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
      return { buffer: Buffer.from(text, 'utf-8'), contentType: 'application/json' };
    }

    case 'raw': {
      const text = typeof body.content === 'string' ? body.content : body.content.toString();
      return { buffer: Buffer.from(text, 'utf-8'), contentType: 'text/plain' };
    }

    case 'x-www-form-urlencoded': {
      const text = typeof body.content === 'string' ? body.content : '';
      return {
        buffer: Buffer.from(text, 'utf-8'),
        contentType: 'application/x-www-form-urlencoded',
      };
    }

    case 'binary': {
      const buf = Buffer.isBuffer(body.content)
        ? body.content
        : Buffer.from(body.content as string, 'binary');
      return { buffer: buf, contentType: 'application/octet-stream' };
    }

    case 'graphql': {
      // content is a JSON string like { "query": "...", "variables": {...} }
      const text = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
      return { buffer: Buffer.from(text, 'utf-8'), contentType: 'application/json' };
    }

    case 'form-data': {
      const fields = Array.isArray(body.content) ? (body.content as FormDataField[]) : [];
      const parts: Buffer[] = [];
      for (const field of fields) {
        let disposition = `Content-Disposition: form-data; name="${field.name}"`;
        if (field.filename) {
          disposition += `; filename="${field.filename}"`;
        }
        const ct = field.contentType ?? (Buffer.isBuffer(field.value) ? 'application/octet-stream' : 'text/plain');
        const header = `--${BOUNDARY}\r\n${disposition}\r\nContent-Type: ${ct}\r\n\r\n`;
        const valueBuffer = Buffer.isBuffer(field.value)
          ? field.value
          : Buffer.from(field.value as string, 'utf-8');
        parts.push(Buffer.from(header, 'utf-8'), valueBuffer, Buffer.from('\r\n', 'utf-8'));
      }
      parts.push(Buffer.from(`--${BOUNDARY}--\r\n`, 'utf-8'));
      return {
        buffer: Buffer.concat(parts),
        contentType: `multipart/form-data; boundary=${BOUNDARY}`,
      };
    }

    default:
      return { buffer: Buffer.alloc(0), contentType: '' };
  }
}

// ---------------------------------------------------------------------------
// Response parsing helpers
// ---------------------------------------------------------------------------

/** Parse Set-Cookie header values into Cookie objects */
export function parseCookies(setCookieHeaders: string[], requestUrl: string): Cookie[] {
  const parsed = new url.URL(requestUrl);
  const domain = parsed.hostname;

  return setCookieHeaders.map((header) => {
    const parts = header.split(';').map((p) => p.trim());
    const [rawNameValue, ...attributes] = parts;
    const nameValue = rawNameValue ?? '';
    const eqIdx = nameValue.indexOf('=');
    const name = eqIdx >= 0 ? nameValue.slice(0, eqIdx).trim() : nameValue.trim();
    const value = eqIdx >= 0 ? nameValue.slice(eqIdx + 1).trim() : '';

    const cookie: Cookie = {
      name,
      value,
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
    };

    for (const attr of attributes) {
      const lower = attr.toLowerCase();
      if (lower === 'httponly') {
        cookie.httpOnly = true;
      } else if (lower === 'secure') {
        cookie.secure = true;
      } else if (lower.startsWith('path=')) {
        cookie.path = attr.slice(5).trim();
      } else if (lower.startsWith('domain=')) {
        cookie.domain = attr.slice(7).trim();
      } else if (lower.startsWith('expires=')) {
        const d = new Date(attr.slice(8).trim());
        if (!isNaN(d.getTime())) {
          cookie.expires = d;
        }
      }
    }

    return cookie;
  });
}

/**
 * Parse the raw response body buffer based on the Content-Type header.
 * Returns a string for text-based types, Buffer for binary.
 */
export function parseResponseBody(
  buffer: Buffer,
  contentType: string
): string | Buffer {
  const ct = contentType.toLowerCase();
  if (
    ct.includes('application/json') ||
    ct.includes('text/') ||
    ct.includes('application/xml') ||
    ct.includes('application/xhtml') ||
    ct.includes('application/javascript') ||
    ct.includes('application/x-www-form-urlencoded')
  ) {
    return buffer.toString('utf-8');
  }
  return buffer;
}

/** Map numeric status code to a human-readable text */
export function statusText(code: number): string {
  const map: Record<number, string> = {
    100: 'Continue', 101: 'Switching Protocols',
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
    422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[code] ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Core HTTP execution
// ---------------------------------------------------------------------------

/**
 * Execute an HTTP/HTTPS request using Node.js built-in modules.
 * Resolves with an HttpResponse or rejects on network error / timeout.
 */
export function executeHttpRequest(
  request: HttpRequest,
  timeoutMs = 30_000
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    // 1. Parse and build the URL (merge query params)
    let parsedUrl: url.URL;
    try {
      parsedUrl = new url.URL(request.url);
    } catch {
      return reject(new Error(`Invalid URL: ${request.url}`));
    }

    for (const [key, value] of Object.entries(request.queryParams ?? {})) {
      parsedUrl.searchParams.set(key, value);
    }

    // 2. Serialise body
    let bodyBuffer: Buffer | null = null;
    const reqHeaders: Record<string, string> = { ...request.headers };

    if (request.body && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const { buffer, contentType } = serializeBody(request.body);
      bodyBuffer = buffer;
      if (contentType && !reqHeaders['content-type'] && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = contentType;
      }
      if (!reqHeaders['content-length'] && !reqHeaders['Content-Length']) {
        reqHeaders['Content-Length'] = String(buffer.length);
      }
    }

    // 3. Build options
    const isHttps = parsedUrl.protocol === 'https:';
    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: request.method,
      headers: reqHeaders,
    };

    const transport = isHttps ? https : http;
    const startTime = Date.now();

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => chunks.push(chunk));

      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        const rawBody = Buffer.concat(chunks);
        const contentType = (res.headers['content-type'] as string) ?? '';
        const parsedBody = parseResponseBody(rawBody, contentType);

        // Flatten headers (Node may return string[])
        const flatHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) {
            flatHeaders[k] = v.join(', ');
          } else if (v !== undefined) {
            flatHeaders[k] = v;
          }
        }

        // Extract cookies
        const setCookieRaw = res.headers['set-cookie'] ?? [];
        const cookies = parseCookies(
          Array.isArray(setCookieRaw) ? setCookieRaw : [setCookieRaw],
          request.url
        );

        const response: HttpResponse = {
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? statusText(res.statusCode ?? 0),
          headers: flatHeaders,
          body: parsedBody,
          time: elapsed,
          size: rawBody.length,
          cookies,
        };

        resolve(response);
      });

      res.on('error', reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));

    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// RequestManager class
// ---------------------------------------------------------------------------

export class RequestManager {
  constructor(private _context: vscode.ExtensionContext) {}

  /** Send an HTTP request and return the response */
  async sendRequest(request: HttpRequest): Promise<HttpResponse> {
    const timeout: number =
      vscode.workspace.getConfiguration('apimate').get('requestTimeout') ?? 30_000;
    return executeHttpRequest(request, timeout);
  }

  /** Execute pre-request script (placeholder – implemented in Phase 6) */
  async executePreRequestScript(_script: string, _context: any): Promise<void> {
    throw new Error('Not implemented');
  }

  /** Execute post-request script (placeholder – implemented in Phase 6) */
  async executePostRequestScript(_script: string, _context: any): Promise<any[]> {
    throw new Error('Not implemented');
  }

  /** Resolve variables in text (placeholder – implemented in Phase 4) */
  resolveVariables(text: string): string {
    return text;
  }
}
