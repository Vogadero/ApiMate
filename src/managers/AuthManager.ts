import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { HttpRequest } from './RequestManager';

// ---------------------------------------------------------------------------
// Auth data models
// ---------------------------------------------------------------------------

export type AuthType = 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'aws-sigv4';

export interface BasicAuth {
  username: string;
  password: string;
}

export interface BearerAuth {
  token: string;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query' | 'cookie';
}

export interface OAuth2Auth {
  grantType: 'authorization_code' | 'client_credentials' | 'implicit' | 'password';
  accessTokenUrl: string;
  authorizationUrl?: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number; // Unix timestamp (ms)
}

export interface AwsSigV4Auth {
  accessKey: string;
  secretKey: string;
  region: string;
  service: string;
}

export interface AuthConfig {
  type: AuthType;
  config: BasicAuth | BearerAuth | ApiKeyAuth | OAuth2Auth | AwsSigV4Auth | Record<string, never>;
}

// ---------------------------------------------------------------------------
// Cookie data model
// ---------------------------------------------------------------------------

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: Date;
  httpOnly: boolean;
  secure: boolean;
}

// ---------------------------------------------------------------------------
// AWS SigV4 helpers
// ---------------------------------------------------------------------------

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function toHex(buf: Buffer): string {
  return buf.toString('hex');
}

/**
 * Build AWS Signature V4 Authorization header and return the headers to add.
 * Mutates nothing – returns a Record of headers to merge.
 */
function buildAwsSigV4Headers(
  request: HttpRequest,
  auth: AwsSigV4Auth
): Record<string, string> {
  const parsedUrl = new url.URL(request.url);
  const method = request.method.toUpperCase();
  const now = new Date();

  // Date strings
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  // Canonical URI
  const canonicalUri = parsedUrl.pathname || '/';

  // Canonical query string (sorted)
  const queryParams: [string, string][] = [];
  parsedUrl.searchParams.forEach((v, k) => queryParams.push([k, v]));
  for (const [k, v] of Object.entries(request.queryParams ?? {})) {
    queryParams.push([k, v]);
  }
  queryParams.sort(([a], [b]) => a.localeCompare(b));
  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Headers to sign
  const host = parsedUrl.hostname + (parsedUrl.port ? `:${parsedUrl.port}` : '');
  const headersToSign: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
  };

  // Payload hash
  const bodyContent = request.body
    ? typeof request.body.content === 'string'
      ? request.body.content
      : Buffer.isBuffer(request.body.content)
        ? request.body.content
        : ''
    : '';
  const payloadHash = sha256Hex(
    typeof bodyContent === 'string' ? bodyContent : bodyContent
  );

  // Canonical headers
  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headersToSign[k]!.trim()}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  // Canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${auth.region}/${auth.service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Signing key
  const kDate = hmacSha256(`AWS4${auth.secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, auth.region);
  const kService = hmacSha256(kRegion, auth.service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  // Signature
  const signature = toHex(hmacSha256(kSigning, stringToSign));

  const authorizationHeader =
    `${algorithm} Credential=${auth.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorizationHeader,
    'X-Amz-Date': amzDate,
  };
}

// ---------------------------------------------------------------------------
// OAuth2 token fetch helper (Node.js https, no external deps)
// ---------------------------------------------------------------------------

function postForm(
  tokenUrl: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const bodyBuf = Buffer.from(body, 'utf-8');

    let parsedUrl: url.URL;
    try {
      parsedUrl = new url.URL(tokenUrl);
    } catch {
      return reject(new Error(`Invalid token URL: ${tokenUrl}`));
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(bodyBuf.length),
      },
    };

    const transport = isHttps ? https : http;
    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(text) as Record<string, unknown>);
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${String(e)}`));
        }
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// AuthManager
// ---------------------------------------------------------------------------

export class AuthManager {
  /** cookie store: domain -> Cookie[] */
  private cookieStore: Map<string, Cookie[]> = new Map();

  // -------------------------------------------------------------------------
  // 5.1 Auth application
  // -------------------------------------------------------------------------

  /**
   * Apply authentication to a request by mutating its headers / queryParams.
   * Requirement 6.
   */
  applyAuth(request: HttpRequest, auth: AuthConfig): void {
    if (auth.type === 'none') {
      return;
    }

    switch (auth.type) {
      case 'basic': {
        // 5.1.2 Basic auth: base64("username:password")
        const cfg = auth.config as BasicAuth;
        const encoded = Buffer.from(`${cfg.username}:${cfg.password}`, 'utf-8').toString('base64');
        request.headers['Authorization'] = `Basic ${encoded}`;
        break;
      }

      case 'bearer': {
        // 5.1.3 Bearer token
        const cfg = auth.config as BearerAuth;
        request.headers['Authorization'] = `Bearer ${cfg.token}`;
        break;
      }

      case 'api-key': {
        // 5.1.4 API Key
        const cfg = auth.config as ApiKeyAuth;
        if (cfg.addTo === 'header') {
          request.headers[cfg.key] = cfg.value;
        } else if (cfg.addTo === 'query') {
          request.queryParams[cfg.key] = cfg.value;
        } else if (cfg.addTo === 'cookie') {
          const existing = request.headers['Cookie'];
          request.headers['Cookie'] = existing
            ? `${existing}; ${cfg.key}=${cfg.value}`
            : `${cfg.key}=${cfg.value}`;
        }
        break;
      }

      case 'oauth2': {
        // Apply existing access token if available
        const cfg = auth.config as OAuth2Auth;
        if (cfg.accessToken) {
          request.headers['Authorization'] = `Bearer ${cfg.accessToken}`;
        }
        break;
      }

      case 'aws-sigv4': {
        // 5.1.8 AWS Signature V4
        const cfg = auth.config as AwsSigV4Auth;
        const sigHeaders = buildAwsSigV4Headers(request, cfg);
        Object.assign(request.headers, sigHeaders);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5.1.5 / 5.1.6 / 5.1.7 OAuth2 token management
  // -------------------------------------------------------------------------

  /**
   * Refresh or obtain an OAuth2 token.
   * - If refreshToken is present and accessToken is expired → use refresh_token grant.
   * - If grantType is 'client_credentials' → use client_credentials grant.
   * - If grantType is 'authorization_code' and no accessToken → throw (requires browser flow).
   * Returns an updated OAuth2Auth with the new token data.
   */
  async refreshOAuth2Token(auth: OAuth2Auth): Promise<OAuth2Auth> {
    const now = Date.now();
    const isExpired = auth.tokenExpiry !== undefined && auth.tokenExpiry <= now;

    // 5.1.7 Token refresh using refresh_token
    if (auth.refreshToken && (isExpired || !auth.accessToken)) {
      const params: Record<string, string> = {
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
      };
      if (auth.scope) {
        params['scope'] = auth.scope;
      }

      const data = await postForm(auth.accessTokenUrl, params);
      return this._applyTokenResponse(auth, data);
    }

    // 5.1.6 Client credentials flow
    if (auth.grantType === 'client_credentials') {
      const params: Record<string, string> = {
        grant_type: 'client_credentials',
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
      };
      if (auth.scope) {
        params['scope'] = auth.scope;
      }

      const data = await postForm(auth.accessTokenUrl, params);
      return this._applyTokenResponse(auth, data);
    }

    // 5.1.5 Authorization code flow – token already obtained, just return as-is
    // (The actual browser redirect is handled by the UI layer)
    if (auth.accessToken && !isExpired) {
      return auth;
    }

    throw new Error(
      `Cannot obtain OAuth2 token: grantType=${auth.grantType}, no valid token or refresh token available`
    );
  }

  private _applyTokenResponse(
    auth: OAuth2Auth,
    data: Record<string, unknown>
  ): OAuth2Auth {
    const accessToken = data['access_token'] as string | undefined;
    if (!accessToken) {
      throw new Error(`OAuth2 token response missing access_token: ${JSON.stringify(data)}`);
    }

    const expiresIn = typeof data['expires_in'] === 'number' ? (data['expires_in'] as number) : undefined;
    const refreshToken = (data['refresh_token'] as string | undefined) ?? auth.refreshToken;

    return {
      ...auth,
      accessToken,
      refreshToken,
      tokenExpiry: expiresIn !== undefined ? Date.now() + expiresIn * 1000 : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // 5.2 Cookie management
  // -------------------------------------------------------------------------

  /**
   * 5.2.2 Store a cookie by domain.
   * Replaces any existing cookie with the same name+domain+path.
   */
  storeCookie(cookie: Cookie): void {
    const domain = cookie.domain.toLowerCase();
    const existing = this.cookieStore.get(domain) ?? [];

    // Replace if same name+path
    const idx = existing.findIndex(
      (c) => c.name === cookie.name && c.path === cookie.path
    );
    if (idx >= 0) {
      existing[idx] = cookie;
    } else {
      existing.push(cookie);
    }

    this.cookieStore.set(domain, existing);
  }

  /**
   * 5.2.3 / 5.2.4 Get non-expired cookies for a domain.
   * Matches exact domain and parent domains (e.g. ".example.com" matches "api.example.com").
   */
  getCookiesForDomain(domain: string): Cookie[] {
    this.cleanExpiredCookies();
    const lowerDomain = domain.toLowerCase();
    const result: Cookie[] = [];

    for (const [storedDomain, cookies] of this.cookieStore.entries()) {
      const normalised = storedDomain.startsWith('.')
        ? storedDomain.slice(1)
        : storedDomain;

      if (
        lowerDomain === normalised ||
        lowerDomain.endsWith(`.${normalised}`) ||
        lowerDomain === storedDomain
      ) {
        result.push(...cookies);
      }
    }

    return result;
  }

  /**
   * 5.2.5 Delete a specific cookie by name and domain.
   */
  deleteCookie(name: string, domain: string): void {
    const lowerDomain = domain.toLowerCase();
    const existing = this.cookieStore.get(lowerDomain);
    if (!existing) {
      return;
    }
    const filtered = existing.filter((c) => c.name !== name);
    if (filtered.length === 0) {
      this.cookieStore.delete(lowerDomain);
    } else {
      this.cookieStore.set(lowerDomain, filtered);
    }
  }

  /**
   * 5.2.4 Remove all expired cookies from the store.
   */
  cleanExpiredCookies(): void {
    const now = new Date();
    for (const [domain, cookies] of this.cookieStore.entries()) {
      const valid = cookies.filter((c) => !c.expires || c.expires > now);
      if (valid.length === 0) {
        this.cookieStore.delete(domain);
      } else {
        this.cookieStore.set(domain, valid);
      }
    }
  }

  /**
   * 5.2.3 Apply stored cookies to a request by adding/merging the Cookie header.
   */
  applyCookiesToRequest(request: HttpRequest): void {
    let parsedUrl: url.URL;
    try {
      parsedUrl = new url.URL(request.url);
    } catch {
      return;
    }

    const cookies = this.getCookiesForDomain(parsedUrl.hostname);
    if (cookies.length === 0) {
      return;
    }

    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const existing = request.headers['Cookie'];
    request.headers['Cookie'] = existing
      ? `${existing}; ${cookieHeader}`
      : cookieHeader;
  }

  /**
   * Return all cookies in the store (for the cookie viewer UI).
   * Requirement 7.3.
   */
  getAllCookies(): Cookie[] {
    const all: Cookie[] = [];
    for (const cookies of this.cookieStore.values()) {
      all.push(...cookies);
    }
    return all;
  }

  clearAllCookies(): void {
    this.cookieStore.clear();
  }
}
