import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import {
  AuthManager,
  AuthConfig,
  BasicAuth,
  BearerAuth,
  ApiKeyAuth,
  OAuth2Auth,
  AwsSigV4Auth,
  Cookie,
} from '../../managers/AuthManager';
import { HttpRequest } from '../../managers/RequestManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    id: 'test-id',
    name: 'Test',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {},
    queryParams: {},
    ...overrides,
  };
}

function makeCookie(overrides: Partial<Cookie> = {}): Cookie {
  return {
    name: 'session',
    value: 'abc123',
    domain: 'example.com',
    path: '/',
    httpOnly: false,
    secure: false,
    ...overrides,
  };
}

/**
 * Spin up a minimal HTTP server that responds to token requests.
 */
function createTokenServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// 5.1.2 Basic authentication
// ---------------------------------------------------------------------------

suite('AuthManager - Basic authentication', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds Authorization: Basic header with base64-encoded credentials', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'basic',
      config: { username: 'alice', password: 'secret' } as BasicAuth,
    };
    manager.applyAuth(request, auth);

    const expected = 'Basic ' + Buffer.from('alice:secret').toString('base64');
    assert.strictEqual(request.headers['Authorization'], expected);
  });

  test('handles empty username and password', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'basic',
      config: { username: '', password: '' } as BasicAuth,
    };
    manager.applyAuth(request, auth);

    const expected = 'Basic ' + Buffer.from(':').toString('base64');
    assert.strictEqual(request.headers['Authorization'], expected);
  });

  test('handles special characters in credentials', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'basic',
      config: { username: 'user@domain.com', password: 'p@$$w0rd!' } as BasicAuth,
    };
    manager.applyAuth(request, auth);

    const encoded = Buffer.from('user@domain.com:p@$$w0rd!').toString('base64');
    assert.strictEqual(request.headers['Authorization'], `Basic ${encoded}`);
  });

  test('does not modify queryParams', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'basic',
      config: { username: 'u', password: 'p' } as BasicAuth,
    };
    manager.applyAuth(request, auth);
    assert.deepStrictEqual(request.queryParams, {});
  });
});

// ---------------------------------------------------------------------------
// 5.1.3 Bearer token authentication
// ---------------------------------------------------------------------------

suite('AuthManager - Bearer token authentication', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds Authorization: Bearer header', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'bearer',
      config: { token: 'my-jwt-token' } as BearerAuth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['Authorization'], 'Bearer my-jwt-token');
  });

  test('handles token with special characters', () => {
    const request = makeRequest();
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123';
    const auth: AuthConfig = {
      type: 'bearer',
      config: { token } as BearerAuth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['Authorization'], `Bearer ${token}`);
  });

  test('does not modify queryParams', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'bearer',
      config: { token: 'tok' } as BearerAuth,
    };
    manager.applyAuth(request, auth);
    assert.deepStrictEqual(request.queryParams, {});
  });
});

// ---------------------------------------------------------------------------
// 5.1.4 API Key authentication
// ---------------------------------------------------------------------------

suite('AuthManager - API Key authentication (header)', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds key:value to request headers', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'api-key',
      config: { key: 'X-API-Key', value: 'my-key-123', addTo: 'header' } as ApiKeyAuth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['X-API-Key'], 'my-key-123');
  });

  test('does not modify queryParams when adding to header', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'api-key',
      config: { key: 'X-API-Key', value: 'val', addTo: 'header' } as ApiKeyAuth,
    };
    manager.applyAuth(request, auth);
    assert.deepStrictEqual(request.queryParams, {});
  });
});

suite('AuthManager - API Key authentication (query)', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds key=value to queryParams', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'api-key',
      config: { key: 'api_key', value: 'secret-key', addTo: 'query' } as ApiKeyAuth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.queryParams['api_key'], 'secret-key');
  });

  test('does not modify headers when adding to query', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'api-key',
      config: { key: 'api_key', value: 'val', addTo: 'query' } as ApiKeyAuth,
    };
    manager.applyAuth(request, auth);
    assert.deepStrictEqual(request.headers, {});
  });
});

suite('AuthManager - API Key authentication (cookie)', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds key=value to Cookie header', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'api-key',
      config: { key: 'api_key', value: 'cookie-val', addTo: 'cookie' } as ApiKeyAuth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['Cookie'], 'api_key=cookie-val');
  });

  test('appends to existing Cookie header', () => {
    const request = makeRequest({ headers: { Cookie: 'session=abc' } });
    const auth: AuthConfig = {
      type: 'api-key',
      config: { key: 'api_key', value: 'val', addTo: 'cookie' } as ApiKeyAuth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['Cookie'], 'session=abc; api_key=val');
  });
});

// ---------------------------------------------------------------------------
// 5.1.5 / 5.1.6 / 5.1.7 OAuth2
// ---------------------------------------------------------------------------

suite('AuthManager - OAuth2 apply existing token', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('applies existing accessToken as Bearer header', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'oauth2',
      config: {
        grantType: 'client_credentials',
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
        accessToken: 'existing-token',
      } as OAuth2Auth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['Authorization'], 'Bearer existing-token');
  });

  test('does not add Authorization header when no accessToken', () => {
    const request = makeRequest();
    const auth: AuthConfig = {
      type: 'oauth2',
      config: {
        grantType: 'client_credentials',
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
      } as OAuth2Auth,
    };
    manager.applyAuth(request, auth);
    assert.strictEqual(request.headers['Authorization'], undefined);
  });
});

suite('AuthManager - OAuth2 client credentials flow', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('fetches token via client_credentials grant', async () => {
    const srv = await createTokenServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'new-token', expires_in: 3600 }));
    });

    try {
      const auth: OAuth2Auth = {
        grantType: 'client_credentials',
        accessTokenUrl: `http://127.0.0.1:${srv.port}/token`,
        clientId: 'my-client',
        clientSecret: 'my-secret',
      };

      const updated = await manager.refreshOAuth2Token(auth);
      assert.strictEqual(updated.accessToken, 'new-token');
      assert.ok(updated.tokenExpiry !== undefined);
      assert.ok(updated.tokenExpiry! > Date.now());
    } finally {
      await srv.close();
    }
  });

  test('includes scope in request when provided', async () => {
    let receivedBody = '';
    const srv = await createTokenServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString('utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'tok' }));
      });
    });

    try {
      const auth: OAuth2Auth = {
        grantType: 'client_credentials',
        accessTokenUrl: `http://127.0.0.1:${srv.port}/token`,
        clientId: 'id',
        clientSecret: 'secret',
        scope: 'read write',
      };

      await manager.refreshOAuth2Token(auth);
      assert.ok(receivedBody.includes('scope=read+write') || receivedBody.includes('scope=read%20write'));
    } finally {
      await srv.close();
    }
  });

  test('throws when token response is missing access_token', async () => {
    const srv = await createTokenServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_client' }));
    });

    try {
      const auth: OAuth2Auth = {
        grantType: 'client_credentials',
        accessTokenUrl: `http://127.0.0.1:${srv.port}/token`,
        clientId: 'id',
        clientSecret: 'secret',
      };

      await assert.rejects(() => manager.refreshOAuth2Token(auth), /access_token/);
    } finally {
      await srv.close();
    }
  });
});

suite('AuthManager - OAuth2 token refresh', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('uses refresh_token grant when token is expired', async () => {
    let receivedBody = '';
    const srv = await createTokenServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString('utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'refreshed-token', expires_in: 3600 }));
      });
    });

    try {
      const auth: OAuth2Auth = {
        grantType: 'authorization_code',
        accessTokenUrl: `http://127.0.0.1:${srv.port}/token`,
        clientId: 'id',
        clientSecret: 'secret',
        accessToken: 'old-token',
        refreshToken: 'my-refresh-token',
        tokenExpiry: Date.now() - 1000, // expired
      };

      const updated = await manager.refreshOAuth2Token(auth);
      assert.strictEqual(updated.accessToken, 'refreshed-token');
      assert.ok(receivedBody.includes('grant_type=refresh_token'));
      assert.ok(receivedBody.includes('refresh_token=my-refresh-token'));
    } finally {
      await srv.close();
    }
  });

  test('returns existing auth when token is still valid and no refresh needed', async () => {
    const auth: OAuth2Auth = {
      grantType: 'authorization_code',
      accessTokenUrl: 'http://localhost/token',
      clientId: 'id',
      clientSecret: 'secret',
      accessToken: 'valid-token',
      tokenExpiry: Date.now() + 3600_000, // not expired
    };

    const result = await manager.refreshOAuth2Token(auth);
    assert.strictEqual(result.accessToken, 'valid-token');
  });

  test('throws when no token and no refresh token for authorization_code flow', async () => {
    const auth: OAuth2Auth = {
      grantType: 'authorization_code',
      accessTokenUrl: 'http://localhost/token',
      clientId: 'id',
      clientSecret: 'secret',
    };

    await assert.rejects(() => manager.refreshOAuth2Token(auth));
  });
});

// ---------------------------------------------------------------------------
// 5.1.8 AWS Signature V4
// ---------------------------------------------------------------------------

suite('AuthManager - AWS Signature V4', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds Authorization header with AWS4-HMAC-SHA256 algorithm', () => {
    const request = makeRequest({ url: 'https://s3.amazonaws.com/my-bucket/object' });
    const auth: AuthConfig = {
      type: 'aws-sigv4',
      config: {
        accessKey: 'AKIAIOSFODNN7EXAMPLE',
        secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        service: 's3',
      } as AwsSigV4Auth,
    };
    manager.applyAuth(request, auth);

    assert.ok(request.headers['Authorization'], 'Authorization header should be set');
    assert.ok(
      request.headers['Authorization']!.startsWith('AWS4-HMAC-SHA256'),
      'Authorization should use AWS4-HMAC-SHA256'
    );
  });

  test('adds X-Amz-Date header', () => {
    const request = makeRequest({ url: 'https://s3.amazonaws.com/bucket' });
    const auth: AuthConfig = {
      type: 'aws-sigv4',
      config: {
        accessKey: 'AKID',
        secretKey: 'SECRET',
        region: 'eu-west-1',
        service: 's3',
      } as AwsSigV4Auth,
    };
    manager.applyAuth(request, auth);

    assert.ok(request.headers['X-Amz-Date'], 'X-Amz-Date header should be set');
    // Format: YYYYMMDDTHHmmssZ
    assert.match(request.headers['X-Amz-Date']!, /^\d{8}T\d{6}Z$/);
  });

  test('Authorization header contains Credential with access key', () => {
    const request = makeRequest({ url: 'https://execute-api.us-east-1.amazonaws.com/prod/users' });
    const auth: AuthConfig = {
      type: 'aws-sigv4',
      config: {
        accessKey: 'MYACCESSKEY',
        secretKey: 'mysecretkey',
        region: 'us-east-1',
        service: 'execute-api',
      } as AwsSigV4Auth,
    };
    manager.applyAuth(request, auth);

    assert.ok(request.headers['Authorization']!.includes('Credential=MYACCESSKEY/'));
  });

  test('Authorization header contains SignedHeaders', () => {
    const request = makeRequest({ url: 'https://s3.amazonaws.com/bucket' });
    const auth: AuthConfig = {
      type: 'aws-sigv4',
      config: {
        accessKey: 'KEY',
        secretKey: 'SECRET',
        region: 'us-east-1',
        service: 's3',
      } as AwsSigV4Auth,
    };
    manager.applyAuth(request, auth);

    assert.ok(request.headers['Authorization']!.includes('SignedHeaders='));
  });

  test('Authorization header contains Signature', () => {
    const request = makeRequest({ url: 'https://s3.amazonaws.com/bucket' });
    const auth: AuthConfig = {
      type: 'aws-sigv4',
      config: {
        accessKey: 'KEY',
        secretKey: 'SECRET',
        region: 'us-east-1',
        service: 's3',
      } as AwsSigV4Auth,
    };
    manager.applyAuth(request, auth);

    assert.ok(request.headers['Authorization']!.includes('Signature='));
    // Signature should be a 64-char hex string
    const sigMatch = request.headers['Authorization']!.match(/Signature=([0-9a-f]+)/);
    assert.ok(sigMatch, 'Signature should be present');
    assert.strictEqual(sigMatch![1]!.length, 64);
  });
});

// ---------------------------------------------------------------------------
// 5.2.1 / 5.2.2 Cookie data model and storage
// ---------------------------------------------------------------------------

suite('AuthManager - Cookie storage', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('storeCookie stores a cookie retrievable by domain', () => {
    const cookie = makeCookie({ domain: 'example.com' });
    manager.storeCookie(cookie);

    const cookies = manager.getCookiesForDomain('example.com');
    assert.strictEqual(cookies.length, 1);
    assert.strictEqual(cookies[0]!.name, 'session');
    assert.strictEqual(cookies[0]!.value, 'abc123');
  });

  test('storeCookie replaces existing cookie with same name and path', () => {
    manager.storeCookie(makeCookie({ name: 'token', value: 'old', domain: 'example.com' }));
    manager.storeCookie(makeCookie({ name: 'token', value: 'new', domain: 'example.com' }));

    const cookies = manager.getCookiesForDomain('example.com');
    assert.strictEqual(cookies.length, 1);
    assert.strictEqual(cookies[0]!.value, 'new');
  });

  test('storeCookie stores multiple different cookies for same domain', () => {
    manager.storeCookie(makeCookie({ name: 'a', domain: 'example.com' }));
    manager.storeCookie(makeCookie({ name: 'b', domain: 'example.com' }));

    const cookies = manager.getCookiesForDomain('example.com');
    assert.strictEqual(cookies.length, 2);
  });

  test('getCookiesForDomain returns empty array for unknown domain', () => {
    const cookies = manager.getCookiesForDomain('unknown.com');
    assert.deepStrictEqual(cookies, []);
  });

  test('getCookiesForDomain matches subdomain against parent domain cookie', () => {
    manager.storeCookie(makeCookie({ domain: '.example.com' }));
    const cookies = manager.getCookiesForDomain('api.example.com');
    assert.strictEqual(cookies.length, 1);
  });

  test('getAllCookies returns all stored cookies', () => {
    manager.storeCookie(makeCookie({ name: 'a', domain: 'example.com' }));
    manager.storeCookie(makeCookie({ name: 'b', domain: 'other.com' }));

    const all = manager.getAllCookies();
    assert.strictEqual(all.length, 2);
  });
});

// ---------------------------------------------------------------------------
// 5.2.4 Cookie expiration handling
// ---------------------------------------------------------------------------

suite('AuthManager - Cookie expiration', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('getCookiesForDomain excludes expired cookies', () => {
    const expired = makeCookie({
      name: 'old',
      domain: 'example.com',
      expires: new Date(Date.now() - 1000),
    });
    const valid = makeCookie({
      name: 'current',
      domain: 'example.com',
      expires: new Date(Date.now() + 3600_000),
    });

    manager.storeCookie(expired);
    manager.storeCookie(valid);

    const cookies = manager.getCookiesForDomain('example.com');
    assert.strictEqual(cookies.length, 1);
    assert.strictEqual(cookies[0]!.name, 'current');
  });

  test('cleanExpiredCookies removes expired cookies', () => {
    manager.storeCookie(makeCookie({
      name: 'expired',
      domain: 'example.com',
      expires: new Date(Date.now() - 1000),
    }));
    manager.storeCookie(makeCookie({
      name: 'valid',
      domain: 'example.com',
      expires: new Date(Date.now() + 3600_000),
    }));

    manager.cleanExpiredCookies();

    const all = manager.getAllCookies();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0]!.name, 'valid');
  });

  test('cookies without expires are never expired', () => {
    manager.storeCookie(makeCookie({ name: 'persistent', domain: 'example.com' }));
    manager.cleanExpiredCookies();

    const cookies = manager.getCookiesForDomain('example.com');
    assert.strictEqual(cookies.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 5.2.5 Cookie deletion
// ---------------------------------------------------------------------------

suite('AuthManager - Cookie deletion', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('deleteCookie removes the specified cookie', () => {
    manager.storeCookie(makeCookie({ name: 'session', domain: 'example.com' }));
    manager.deleteCookie('session', 'example.com');

    const cookies = manager.getCookiesForDomain('example.com');
    assert.deepStrictEqual(cookies, []);
  });

  test('deleteCookie only removes the named cookie, not others', () => {
    manager.storeCookie(makeCookie({ name: 'a', domain: 'example.com' }));
    manager.storeCookie(makeCookie({ name: 'b', domain: 'example.com' }));
    manager.deleteCookie('a', 'example.com');

    const cookies = manager.getCookiesForDomain('example.com');
    assert.strictEqual(cookies.length, 1);
    assert.strictEqual(cookies[0]!.name, 'b');
  });

  test('deleteCookie is idempotent for non-existent cookie', () => {
    assert.doesNotThrow(() => manager.deleteCookie('ghost', 'example.com'));
  });

  test('deleteCookie does not affect cookies on other domains', () => {
    manager.storeCookie(makeCookie({ name: 'session', domain: 'other.com' }));
    manager.deleteCookie('session', 'example.com');

    const cookies = manager.getCookiesForDomain('other.com');
    assert.strictEqual(cookies.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 5.2.3 Automatic cookie inclusion in requests
// ---------------------------------------------------------------------------

suite('AuthManager - applyCookiesToRequest', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('adds Cookie header from stored cookies', () => {
    manager.storeCookie(makeCookie({ name: 'session', value: 'xyz', domain: 'api.example.com' }));

    const request = makeRequest({ url: 'https://api.example.com/data' });
    manager.applyCookiesToRequest(request);

    assert.strictEqual(request.headers['Cookie'], 'session=xyz');
  });

  test('appends to existing Cookie header', () => {
    manager.storeCookie(makeCookie({ name: 'token', value: 'abc', domain: 'api.example.com' }));

    const request = makeRequest({
      url: 'https://api.example.com/data',
      headers: { Cookie: 'existing=val' },
    });
    manager.applyCookiesToRequest(request);

    assert.ok(request.headers['Cookie']!.includes('existing=val'));
    assert.ok(request.headers['Cookie']!.includes('token=abc'));
  });

  test('does not add Cookie header when no cookies for domain', () => {
    const request = makeRequest({ url: 'https://api.example.com/data' });
    manager.applyCookiesToRequest(request);

    assert.strictEqual(request.headers['Cookie'], undefined);
  });

  test('does not throw for invalid URL', () => {
    const request = makeRequest({ url: 'not-a-url' });
    assert.doesNotThrow(() => manager.applyCookiesToRequest(request));
  });

  test('includes multiple cookies separated by semicolons', () => {
    manager.storeCookie(makeCookie({ name: 'a', value: '1', domain: 'example.com' }));
    manager.storeCookie(makeCookie({ name: 'b', value: '2', domain: 'example.com' }));

    const request = makeRequest({ url: 'https://example.com/path' });
    manager.applyCookiesToRequest(request);

    const cookieHeader = request.headers['Cookie']!;
    assert.ok(cookieHeader.includes('a=1'));
    assert.ok(cookieHeader.includes('b=2'));
  });
});

// ---------------------------------------------------------------------------
// auth type 'none'
// ---------------------------------------------------------------------------

suite('AuthManager - auth type none', () => {
  let manager: AuthManager;

  setup(() => { manager = new AuthManager(); });

  test('does not modify request when auth type is none', () => {
    const request = makeRequest();
    const auth: AuthConfig = { type: 'none', config: {} };
    manager.applyAuth(request, auth);

    assert.deepStrictEqual(request.headers, {});
    assert.deepStrictEqual(request.queryParams, {});
  });
});
