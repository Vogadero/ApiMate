import * as vscode from 'vscode';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Collection, Folder, Variable, AuthConfig } from './CollectionManager';
import { HttpRequest, HttpMethod } from './RequestManager';
import { Environment } from './StorageManager';

export interface ImportResult {
  success: boolean;
  collection?: Collection;
  environments?: Environment[];
  errors: string[];
}

function generateId(): string {
  return crypto.randomUUID();
}

export class ImportExportManager {
  constructor(private _context: vscode.ExtensionContext) {}

  async importPostmanCollection(filePath: string): Promise<ImportResult> {
    const errors: string[] = [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const postman = JSON.parse(content) as any;

      if (!postman.info || !postman.info.name) {
        return { success: false, errors: ['Invalid Postman collection: missing info.name'] };
      }

      const collection: Collection = {
        id: generateId(),
        name: postman.info.name,
        folders: [],
        requests: [],
        variables: [],
      };

      if (postman.variable && Array.isArray(postman.variable)) {
        collection.variables = postman.variable
          .filter((v: any) => v.key)
          .map((v: any) => ({
            key: v.key,
            value: String(v.value ?? ''),
            type: 'default' as const,
            enabled: !v.disabled,
          }));
      }

      if (postman.auth) {
        collection.auth = this._convertPostmanAuth(postman.auth);
      }

      if (postman.event && Array.isArray(postman.event)) {
        for (const event of postman.event) {
          if (event.listen === 'prerequest' && event.script?.exec) {
            collection.preRequestScript = Array.isArray(event.script.exec)
              ? event.script.exec.join('\n')
              : String(event.script.exec);
          }
          if (event.listen === 'test' && event.script?.exec) {
            collection.postRequestScript = Array.isArray(event.script.exec)
              ? event.script.exec.join('\n')
              : String(event.script.exec);
          }
        }
      }

      if (postman.item && Array.isArray(postman.item)) {
        for (const item of postman.item) {
          if (item.item && Array.isArray(item.item)) {
            const folder = this._convertPostmanFolder(item);
            collection.folders.push(folder);
          } else if (item.request) {
            const request = this._convertPostmanRequest(item);
            if (request) {
              collection.requests.push(request);
            }
          }
        }
      }

      const environments: Environment[] = [];
      if (postman.environment && Array.isArray(postman.environment)) {
        const env: Environment = {
          id: generateId(),
          name: `${collection.name} Environment`,
          variables: postman.environment
            .filter((v: any) => v.key)
            .map((v: any) => ({
              key: v.key,
              value: String(v.value ?? ''),
              type: v.type === 'secret' ? 'secret' as const : 'default' as const,
              enabled: !v.disabled,
            })),
        };
        environments.push(env);
      }

      return { success: true, collection, environments: environments.length > 0 ? environments : undefined, errors };
    } catch (err: any) {
      errors.push(err instanceof Error ? err.message : String(err));
      return { success: false, errors };
    }
  }

  private _convertPostmanFolder(item: any): Folder {
    const folder: Folder = {
      id: generateId(),
      name: item.name ?? 'Unnamed Folder',
      folders: [],
      requests: [],
    };

    if (item.auth) {
      folder.auth = this._convertPostmanAuth(item.auth);
    }

    if (item.item && Array.isArray(item.item)) {
      for (const subItem of item.item) {
        if (subItem.item && Array.isArray(subItem.item)) {
          folder.folders.push(this._convertPostmanFolder(subItem));
        } else if (subItem.request) {
          const req = this._convertPostmanRequest(subItem);
          if (req) folder.requests.push(req);
        }
      }
    }

    return folder;
  }

  private _convertPostmanRequest(item: any): HttpRequest | null {
    try {
      const req = item.request;
      if (!req) return null;

      const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;
      let url = '';
      const queryParams: Record<string, string> = {};

      if (typeof req.url === 'string') {
        url = req.url;
      } else if (req.url?.raw) {
        url = req.url.raw;
        if (req.url.query && Array.isArray(req.url.query)) {
          for (const q of req.url.query) {
            if (q.key && !q.disabled) {
              queryParams[q.key] = q.value ?? '';
            }
          }
        }
      }

      const headers: Record<string, string> = {};
      if (req.header && Array.isArray(req.header)) {
        for (const h of req.header) {
          if (h.key && !h.disabled) {
            headers[h.key] = h.value ?? '';
          }
        }
      }

      let body: HttpRequest['body'];
      if (req.body) {
        switch (req.body.mode) {
          case 'raw': {
            const rawContent = req.body.raw ?? '';
            const lang = req.body.options?.raw?.language ?? 'text';
            const type = lang === 'json' ? 'json' : lang === 'xml' ? 'raw' : 'raw';
            body = { type: type as any, content: rawContent };
            break;
          }
          case 'formdata': {
            const fields = (req.body.formdata ?? [])
              .filter((f: any) => !f.disabled)
              .map((f: any) => ({
                name: f.key,
                value: f.type === 'file' ? f.src ?? '' : f.value ?? '',
                filename: f.type === 'file' ? f.src?.split('/').pop() : undefined,
                contentType: f.contentType,
              }));
            body = { type: 'form-data', content: fields };
            break;
          }
          case 'urlencoded': {
            const pairs = (req.body.urlencoded ?? [])
              .filter((f: any) => !f.disabled)
              .map((f: any) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value ?? '')}`)
              .join('&');
            body = { type: 'x-www-form-urlencoded', content: pairs };
            break;
          }
          case 'graphql': {
            const gqlBody = req.body.graphql ?? {};
            body = {
              type: 'graphql',
              content: JSON.stringify({
                query: gqlBody.query ?? '',
                variables: gqlBody.variables ? JSON.parse(gqlBody.variables) : {},
              }),
            };
            break;
          }
        }
      }

      let auth: AuthConfig | undefined;
      if (req.auth) {
        auth = this._convertPostmanAuth(req.auth);
      }

      let preRequestScript: string | undefined;
      let postRequestScript: string | undefined;
      if (item.event && Array.isArray(item.event)) {
        for (const event of item.event) {
          if (event.listen === 'prerequest' && event.script?.exec) {
            preRequestScript = Array.isArray(event.script.exec)
              ? event.script.exec.join('\n')
              : String(event.script.exec);
          }
          if (event.listen === 'test' && event.script?.exec) {
            postRequestScript = Array.isArray(event.script.exec)
              ? event.script.exec.join('\n')
              : String(event.script.exec);
          }
        }
      }

      return {
        id: generateId(),
        name: item.name ?? 'Unnamed Request',
        method,
        url,
        headers,
        queryParams,
        body,
        auth: auth as any,
        preRequestScript,
        postRequestScript,
      };
    } catch {
      return null;
    }
  }

  private _convertPostmanAuth(auth: any): AuthConfig {
    switch (auth.type) {
      case 'basic':
        return {
          type: 'basic',
          config: {
            username: (auth.basic?.find((b: any) => b.key === 'username')?.value) ?? '',
            password: (auth.basic?.find((b: any) => b.key === 'password')?.value) ?? '',
          },
        };
      case 'bearer':
        return {
          type: 'bearer',
          config: {
            token: (auth.bearer?.find((b: any) => b.key === 'token')?.value) ?? '',
          },
        };
      case 'apikey':
        return {
          type: 'api-key',
          config: {
            key: (auth.apikey?.find((b: any) => b.key === 'key')?.value) ?? '',
            value: (auth.apikey?.find((b: any) => b.key === 'value')?.value) ?? '',
            addTo: (auth.apikey?.find((b: any) => b.key === 'in')?.value as any) ?? 'header',
          },
        };
      case 'oauth2':
        return {
          type: 'oauth2',
          config: {
            grantType: (auth.oauth2?.find((b: any) => b.key === 'grant_type')?.value) ?? 'authorization_code',
            accessTokenUrl: (auth.oauth2?.find((b: any) => b.key === 'accessTokenUrl')?.value) ?? '',
            authorizationUrl: (auth.oauth2?.find((b: any) => b.key === 'authUrl')?.value) ?? '',
            clientId: (auth.oauth2?.find((b: any) => b.key === 'clientId')?.value) ?? '',
            clientSecret: (auth.oauth2?.find((b: any) => b.key === 'clientSecret')?.value) ?? '',
            scope: (auth.oauth2?.find((b: any) => b.key === 'scope')?.value) ?? '',
          },
        };
      case 'awsv4':
        return {
          type: 'aws-sigv4',
          config: {
            accessKey: (auth.awsv4?.find((b: any) => b.key === 'accessKey')?.value) ?? '',
            secretKey: (auth.awsv4?.find((b: any) => b.key === 'secretKey')?.value) ?? '',
            region: (auth.awsv4?.find((b: any) => b.key === 'region')?.value) ?? 'us-east-1',
            service: (auth.awsv4?.find((b: any) => b.key === 'service')?.value) ?? '',
          },
        };
      default:
        return { type: 'none', config: {} };
    }
  }

  async importOpenAPI(filePath: string): Promise<ImportResult> {
    const errors: string[] = [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let spec: any;

      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        try {
          const yaml = require('js-yaml');
          spec = yaml.load(content);
        } catch {
          return { success: false, errors: ['YAML parsing requires js-yaml package'] };
        }
      } else {
        spec = JSON.parse(content);
      }

      if (!spec.openapi || !spec.paths) {
        return { success: false, errors: ['Invalid OpenAPI specification: missing openapi or paths'] };
      }

      const collection: Collection = {
        id: generateId(),
        name: spec.info?.title ?? 'Imported OpenAPI',
        folders: [],
        requests: [],
        variables: [],
      };

      if (spec.servers && Array.isArray(spec.servers)) {
        collection.variables.push({
          key: 'baseUrl',
          value: spec.servers[0]?.url ?? '',
          type: 'default',
          enabled: true,
        });
      }

      if (spec.components?.securitySchemes) {
        const schemes = spec.components.securitySchemes;
        for (const [name, scheme] of Object.entries(schemes)) {
          const s = scheme as any;
          if (s.type === 'http' && s.scheme === 'bearer') {
            collection.auth = { type: 'bearer', config: { token: `{{${name}}}` } };
          } else if (s.type === 'http' && s.scheme === 'basic') {
            collection.auth = { type: 'basic', config: { username: `{{${name}_username}}`, password: `{{${name}_password}}` } };
          } else if (s.type === 'apiKey') {
            collection.auth = {
              type: 'api-key',
              config: {
                key: s.name ?? name,
                value: `{{${name}}}`,
                addTo: s.in ?? 'header',
              },
            };
          }
        }
      }

      for (const [pathStr, pathObj] of Object.entries(spec.paths as Record<string, any>)) {
        for (const [method, operation] of Object.entries(pathObj as Record<string, any>)) {
          if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) {
            const request = this._convertOpenAPIOperation(pathStr, method, operation);
            if (request) {
              collection.requests.push(request);
            }
          }
        }
      }

      return { success: true, collection, errors };
    } catch (err: any) {
      errors.push(err instanceof Error ? err.message : String(err));
      return { success: false, errors };
    }
  }

  private _convertOpenAPIOperation(pathStr: string, method: string, operation: any): HttpRequest | null {
    try {
      const queryParams: Record<string, string> = {};
      const headers: Record<string, string> = {};

      if (operation.parameters && Array.isArray(operation.parameters)) {
        for (const param of operation.parameters) {
          if (param.in === 'query' && !param.deprecated) {
            queryParams[param.name] = param.schema?.default ?? '';
          } else if (param.in === 'header' && !param.deprecated) {
            headers[param.name] = param.schema?.default ?? '';
          }
        }
      }

      let body: HttpRequest['body'];
      if (operation.requestBody) {
        const content = operation.requestBody.content;
        if (content?.['application/json']) {
          const schema = content['application/json'].schema;
          const example = schema?.example ?? this._generateExampleFromSchema(schema);
          body = { type: 'json', content: JSON.stringify(example, null, 2) };
        } else if (content?.['application/x-www-form-urlencoded']) {
          body = { type: 'x-www-form-urlencoded', content: '' };
        } else if (content?.['multipart/form-data']) {
          body = { type: 'form-data', content: [] };
        }
      }

      return {
        id: generateId(),
        name: operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${pathStr}`,
        method: method.toUpperCase() as HttpMethod,
        url: `{{baseUrl}}${pathStr}`,
        headers,
        queryParams,
        body,
      };
    } catch {
      return null;
    }
  }

  private _generateExampleFromSchema(schema: any): any {
    if (!schema) return {};
    if (schema.example) return schema.example;
    if (schema.default !== undefined) return schema.default;

    switch (schema.type) {
      case 'object': {
        const obj: Record<string, any> = {};
        if (schema.properties) {
          for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = this._generateExampleFromSchema(prop);
          }
        }
        return obj;
      }
      case 'array':
        return [this._generateExampleFromSchema(schema.items)];
      case 'string':
        return schema.enum?.[0] ?? '';
      case 'number':
      case 'integer':
        return 0;
      case 'boolean':
        return false;
      default:
        return null;
    }
  }

  async importCurl(curlCommand: string, raw: boolean = false): Promise<HttpRequest> {
    if (raw) {
      let url = curlCommand.trim();
      if (!url) {
        throw new Error('No URL provided');
      }
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error('Invalid URL: ' + url);
      }
      const queryParams: Record<string, string> = {};
      parsedUrl.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
      const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
      return {
        id: generateId(),
        name: `GET ${parsedUrl.pathname}`,
        method: 'GET',
        url: cleanUrl,
        headers: {},
        queryParams,
      };
    }
    const args = this._parseCurlCommand(curlCommand);

    let method: HttpMethod = 'GET';
    let url = '';
    const headers: Record<string, string> = {};
    const queryParams: Record<string, string> = {};
    let body: HttpRequest['body'];
    let auth: AuthConfig | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;

      if (arg === '-X' || arg === '--request') {
        method = (args[++i] ?? 'GET').toUpperCase() as HttpMethod;
      } else if (arg === '-H' || arg === '--header') {
        const headerStr = args[++i] ?? '';
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const key = headerStr.substring(0, colonIdx).trim();
          const value = headerStr.substring(colonIdx + 1).trim();
          headers[key] = value;
        }
      } else if (arg === '-d' || arg === '--data' || arg === '--data-raw' || arg === '--data-binary') {
        const data = args[++i] ?? '';
        if (!body) {
          const contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
          if (contentType.includes('application/json')) {
            body = { type: 'json', content: data };
          } else if (contentType.includes('x-www-form-urlencoded')) {
            body = { type: 'x-www-form-urlencoded', content: data };
          } else {
            body = { type: 'raw', content: data };
          }
        }
        if (method === 'GET') method = 'POST';
      } else if (arg === '-u' || arg === '--user') {
        const userStr = args[++i] ?? '';
        const colonIdx = userStr.indexOf(':');
        auth = {
          type: 'basic',
          config: {
            username: colonIdx > 0 ? userStr.substring(0, colonIdx) : userStr,
            password: colonIdx > 0 ? userStr.substring(colonIdx + 1) : '',
          },
        };
      } else if (arg === '--url') {
        url = args[++i] ?? '';
      } else if (!arg.startsWith('-') && !url) {
        url = arg;
      }
    }

    if (!url) {
      throw new Error('No URL found in cURL command');
    }

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL: ' + url);
    }
    parsedUrl.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    const cleanUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

    return {
      id: generateId(),
      name: `${method} ${parsedUrl.pathname}`,
      method,
      url: cleanUrl,
      headers,
      queryParams,
      body,
      auth: auth as any,
    };
  }

  private _parseCurlCommand(curlCommand: string): string[] {
    const args: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    const trimmed = curlCommand.trim().replace(/^curl\s+/i, '');

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i]!;

      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        escaped = true;
        continue;
      }

      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (ch === ' ' && !inSingleQuote && !inDoubleQuote) {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
        continue;
      }

      current += ch;
    }

    if (current.length > 0) {
      args.push(current);
    }

    return args;
  }

  async importHAR(filePath: string): Promise<ImportResult> {
    const errors: string[] = [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const har = JSON.parse(content) as any;

      if (!har.log || !har.log.entries || !Array.isArray(har.log.entries)) {
        return { success: false, errors: ['Invalid HAR file: missing log.entries'] };
      }

      const collection: Collection = {
        id: generateId(),
        name: `HAR Import - ${new Date().toISOString().slice(0, 10)}`,
        folders: [],
        requests: [],
        variables: [],
      };

      for (const entry of har.log.entries) {
        try {
          const request = this._convertHAREntry(entry);
          if (request) {
            collection.requests.push(request);
          }
        } catch (err: any) {
          errors.push(`Failed to import entry: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return { success: true, collection, errors };
    } catch (err: any) {
      errors.push(err instanceof Error ? err.message : String(err));
      return { success: false, errors };
    }
  }

  private _convertHAREntry(entry: any): HttpRequest | null {
    try {
      const req = entry.request;
      if (!req || !req.url) return null;

      const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;
      const headers: Record<string, string> = {};
      const queryParams: Record<string, string> = {};

      if (req.headers && Array.isArray(req.headers)) {
        for (const h of req.headers) {
          if (h.name) headers[h.name] = h.value ?? '';
        }
      }

      if (req.queryString && Array.isArray(req.queryString)) {
        for (const q of req.queryString) {
          if (q.name) queryParams[q.name] = q.value ?? '';
        }
      }

      let body: HttpRequest['body'];
      if (req.postData) {
        const mimeType = req.postData.mimeType ?? '';
        if (mimeType.includes('application/json')) {
          body = { type: 'json', content: req.postData.text ?? '' };
        } else if (mimeType.includes('x-www-form-urlencoded')) {
          body = { type: 'x-www-form-urlencoded', content: req.postData.text ?? '' };
        } else if (mimeType.includes('multipart/form-data')) {
          body = { type: 'form-data', content: [] };
        } else {
          body = { type: 'raw', content: req.postData.text ?? '' };
        }
      }

      let url = req.url;
      try {
        const parsed = new URL(url);
        parsed.searchParams.forEach((v, k) => {
          if (!(k in queryParams)) queryParams[k] = v;
        });
        url = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
      } catch { /* keep original URL */ }

      return {
        id: generateId(),
        name: `${method} ${url}`,
        method,
        url,
        headers,
        queryParams,
        body,
      };
    } catch {
      return null;
    }
  }

  async exportCollection(collectionId: string, format: 'apimate' | 'postman'): Promise<string> {
    if (format === 'apimate') {
      throw new Error('Collection must be loaded first for ApiMate export');
    }

    throw new Error('Collection must be loaded first for Postman export');
  }

  exportCollectionAsApimate(collection: Collection): string {
    return JSON.stringify({
      version: '1.0',
      id: collection.id,
      name: collection.name,
      folders: collection.folders,
      requests: collection.requests,
      variables: collection.variables,
      auth: collection.auth,
      preRequestScript: collection.preRequestScript,
      postRequestScript: collection.postRequestScript,
    }, null, 2);
  }

  exportCollectionAsPostman(collection: Collection): string {
    const postmanCollection: any = {
      info: {
        name: collection.name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [],
      variable: collection.variables.map((v) => ({
        key: v.key,
        value: v.value,
        type: v.type === 'secret' ? 'secret' : 'string',
      })),
    };

    for (const request of collection.requests) {
      postmanCollection.item.push(this._convertToPostmanItem(request));
    }

    for (const folder of collection.folders) {
      postmanCollection.item.push(this._convertFolderToPostmanItem(folder));
    }

    return JSON.stringify(postmanCollection, null, 2);
  }

  private _convertToPostmanItem(request: HttpRequest): any {
    const item: any = {
      name: request.name,
      request: {
        method: request.method,
        header: Object.entries(request.headers).map(([key, value]) => ({
          key,
          value,
          type: 'text',
        })),
        url: {
          raw: request.url,
          host: ['{{baseUrl}}'],
          path: request.url.replace(/\{\{baseUrl\}\}/, '').split('/').filter(Boolean),
          query: Object.entries(request.queryParams).map(([key, value]) => ({
            key,
            value,
          })),
        },
      },
    };

    if (request.body) {
      switch (request.body.type) {
        case 'json':
          item.request.body = {
            mode: 'raw',
            raw: typeof request.body.content === 'string' ? request.body.content : JSON.stringify(request.body.content),
            options: { raw: { language: 'json' } },
          };
          break;
        case 'form-data':
          item.request.body = {
            mode: 'formdata',
            formdata: Array.isArray(request.body.content)
              ? (request.body.content as any[]).map((f) => ({
                  key: f.name,
                  value: f.value,
                  type: f.filename ? 'file' : 'text',
                }))
              : [],
          };
          break;
        case 'x-www-form-urlencoded':
          item.request.body = {
            mode: 'urlencoded',
            urlencoded: typeof request.body.content === 'string'
              ? request.body.content.split('&').map((pair) => {
                  const [key, ...rest] = pair.split('=');
                  return { key: key ?? '', value: rest.join('='), type: 'text' };
                })
              : [],
          };
          break;
        case 'raw':
          item.request.body = {
            mode: 'raw',
            raw: typeof request.body.content === 'string' ? request.body.content : '',
          };
          break;
      }
    }

    if (request.auth) {
      item.request.auth = this._convertAuthToPostman(request.auth as AuthConfig);
    }

    const events: any[] = [];
    if (request.preRequestScript) {
      events.push({
        listen: 'prerequest',
        script: { type: 'text/javascript', exec: request.preRequestScript.split('\n') },
      });
    }
    if (request.postRequestScript) {
      events.push({
        listen: 'test',
        script: { type: 'text/javascript', exec: request.postRequestScript.split('\n') },
      });
    }
    if (events.length > 0) item.event = events;

    return item;
  }

  private _convertFolderToPostmanItem(folder: Folder): any {
    const item: any = {
      name: folder.name,
      item: [],
    };

    for (const request of folder.requests) {
      item.item.push(this._convertToPostmanItem(request));
    }

    for (const subFolder of folder.folders) {
      item.item.push(this._convertFolderToPostmanItem(subFolder));
    }

    return item;
  }

  private _convertAuthToPostman(auth: AuthConfig): any {
    switch (auth.type) {
      case 'basic':
        return {
          type: 'basic',
          basic: [
            { key: 'username', value: (auth.config as any).username, type: 'string' },
            { key: 'password', value: (auth.config as any).password, type: 'string' },
          ],
        };
      case 'bearer':
        return {
          type: 'bearer',
          bearer: [{ key: 'token', value: (auth.config as any).token, type: 'string' }],
        };
      case 'api-key':
        return {
          type: 'apikey',
          apikey: [
            { key: 'key', value: (auth.config as any).key, type: 'string' },
            { key: 'value', value: (auth.config as any).value, type: 'string' },
            { key: 'in', value: (auth.config as any).addTo, type: 'string' },
          ],
        };
      default:
        return { type: 'noauth' };
    }
  }

  async exportEnvironment(environmentId: string): Promise<string> {
    throw new Error('Environment must be loaded first for export');
  }

  exportEnvironmentAsJson(environment: Environment): string {
    return JSON.stringify({
      version: '1.0',
      id: environment.id,
      name: environment.name,
      variables: environment.variables.map((v) => ({
        key: v.key,
        value: v.type === 'secret' ? '****' : v.value,
        type: v.type,
        enabled: v.enabled,
      })),
    }, null, 2);
  }

  exportRequestAsCurl(request: HttpRequest): string {
    const parts: string[] = ['curl'];

    if (request.method !== 'GET') {
      parts.push(`-X ${request.method}`);
    }

    for (const [key, value] of Object.entries(request.headers)) {
      parts.push(`-H '${key}: ${value}'`);
    }

    if (request.auth) {
      const auth = request.auth as AuthConfig;
      if (auth.type === 'basic') {
        const cfg = auth.config as any;
        parts.push(`-u '${cfg.username}:${cfg.password}'`);
      } else if (auth.type === 'bearer') {
        const cfg = auth.config as any;
        parts.push(`-H 'Authorization: Bearer ${cfg.token}'`);
      }
    }

    if (request.body && request.body.content) {
      const bodyStr = typeof request.body.content === 'string'
        ? request.body.content
        : JSON.stringify(request.body.content);
      parts.push(`-d '${bodyStr.replace(/'/g, "\\'")}'`);
    }

    let fullUrl = request.url;
    const queryParts = Object.entries(request.queryParams);
    if (queryParts.length > 0) {
      const qs = queryParts.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
    }

    parts.push(`'${fullUrl}'`);

    return parts.join(' \\\n  ');
  }
}
