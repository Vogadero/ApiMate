import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import {
  serializeBody,
  parseCookies,
  parseResponseBody,
  statusText,
  executeHttpRequest,
  HttpRequest,
  RequestBody,
  FormDataField,
} from '../../managers/RequestManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    id: 'test-id',
    name: 'Test Request',
    method: 'GET',
    url: 'http://localhost',
    headers: {},
    queryParams: {},
    ...overrides,
  };
}

/**
 * Spin up a minimal HTTP server for integration tests.
 * Returns { server, port, close }.
 */
function createTestServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ server: http.Server; port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        server,
        port: addr.port,
        close: () =>
          new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// serializeBody
// ---------------------------------------------------------------------------

suite('serializeBody - JSON', () => {
  test('returns application/json content-type', () => {
    const body: RequestBody = { type: 'json', content: '{"key":"value"}' };
    const { contentType } = serializeBody(body);
    assert.strictEqual(contentType, 'application/json');
  });

  test('encodes string content as UTF-8 buffer', () => {
    const body: RequestBody = { type: 'json', content: '{"a":1}' };
    const { buffer } = serializeBody(body);
    assert.strictEqual(buffer.toString('utf-8'), '{"a":1}');
  });

  test('handles empty JSON string', () => {
    const body: RequestBody = { type: 'json', content: '' };
    const { buffer } = serializeBody(body);
    assert.strictEqual(buffer.length, 0);
  });
});

suite('serializeBody - raw', () => {
  test('returns text/plain content-type', () => {
    const body: RequestBody = { type: 'raw', content: 'hello world' };
    const { contentType } = serializeBody(body);
    assert.strictEqual(contentType, 'text/plain');
  });

  test('encodes content as UTF-8 buffer', () => {
    const body: RequestBody = { type: 'raw', content: 'hello' };
    const { buffer } = serializeBody(body);
    assert.strictEqual(buffer.toString('utf-8'), 'hello');
  });
});

suite('serializeBody - x-www-form-urlencoded', () => {
  test('returns correct content-type', () => {
    const body: RequestBody = { type: 'x-www-form-urlencoded', content: 'a=1&b=2' };
    const { contentType } = serializeBody(body);
    assert.strictEqual(contentType, 'application/x-www-form-urlencoded');
  });

  test('encodes content as UTF-8 buffer', () => {
    const body: RequestBody = { type: 'x-www-form-urlencoded', content: 'a=1&b=2' };
    const { buffer } = serializeBody(body);
    assert.strictEqual(buffer.toString('utf-8'), 'a=1&b=2');
  });
});

suite('serializeBody - binary', () => {
  test('returns application/octet-stream content-type', () => {
    const body: RequestBody = { type: 'binary', content: Buffer.from([0x01, 0x02]) };
    const { contentType } = serializeBody(body);
    assert.strictEqual(contentType, 'application/octet-stream');
  });

  test('preserves buffer content', () => {
    const original = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const body: RequestBody = { type: 'binary', content: original };
    const { buffer } = serializeBody(body);
    assert.ok(buffer.equals(original));
  });
});

suite('serializeBody - graphql', () => {
  test('returns application/json content-type', () => {
    const body: RequestBody = {
      type: 'graphql',
      content: '{"query":"{ users { id } }"}',
    };
    const { contentType } = serializeBody(body);
    assert.strictEqual(contentType, 'application/json');
  });

  test('encodes query as UTF-8 buffer', () => {
    const payload = '{"query":"{ users { id } }","variables":{}}';
    const body: RequestBody = { type: 'graphql', content: payload };
    const { buffer } = serializeBody(body);
    assert.strictEqual(buffer.toString('utf-8'), payload);
  });
});

suite('serializeBody - form-data', () => {
  test('returns multipart/form-data content-type with boundary', () => {
    const fields: FormDataField[] = [{ name: 'field1', value: 'value1' }];
    const body: RequestBody = { type: 'form-data', content: fields };
    const { contentType } = serializeBody(body);
    assert.ok(contentType.startsWith('multipart/form-data; boundary='));
  });

  test('includes field name in body', () => {
    const fields: FormDataField[] = [{ name: 'username', value: 'alice' }];
    const body: RequestBody = { type: 'form-data', content: fields };
    const { buffer } = serializeBody(body);
    const text = buffer.toString('utf-8');
    assert.ok(text.includes('name="username"'));
    assert.ok(text.includes('alice'));
  });

  test('includes filename for file fields', () => {
    const fields: FormDataField[] = [
      { name: 'file', value: Buffer.from('data'), filename: 'test.txt', contentType: 'text/plain' },
    ];
    const body: RequestBody = { type: 'form-data', content: fields };
    const { buffer } = serializeBody(body);
    const text = buffer.toString('utf-8');
    assert.ok(text.includes('filename="test.txt"'));
  });

  test('handles empty fields array', () => {
    const body: RequestBody = { type: 'form-data', content: [] };
    const { buffer } = serializeBody(body);
    assert.ok(buffer.length > 0); // still has closing boundary
  });

  test('handles multiple fields', () => {
    const fields: FormDataField[] = [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ];
    const body: RequestBody = { type: 'form-data', content: fields };
    const { buffer } = serializeBody(body);
    const text = buffer.toString('utf-8');
    assert.ok(text.includes('name="a"'));
    assert.ok(text.includes('name="b"'));
  });
});

// ---------------------------------------------------------------------------
// parseCookies
// ---------------------------------------------------------------------------

suite('parseCookies', () => {
  test('parses basic name=value cookie', () => {
    const cookies = parseCookies(['session=abc123'], 'http://example.com');
    assert.strictEqual(cookies.length, 1);
    assert.strictEqual(cookies[0]!.name, 'session');
    assert.strictEqual(cookies[0]!.value, 'abc123');
  });

  test('extracts domain from request URL when not in cookie', () => {
    const cookies = parseCookies(['token=xyz'], 'http://api.example.com/path');
    assert.strictEqual(cookies[0]!.domain, 'api.example.com');
  });

  test('parses HttpOnly attribute', () => {
    const cookies = parseCookies(['id=1; HttpOnly'], 'http://example.com');
    assert.strictEqual(cookies[0]!.httpOnly, true);
  });

  test('parses Secure attribute', () => {
    const cookies = parseCookies(['id=1; Secure'], 'http://example.com');
    assert.strictEqual(cookies[0]!.secure, true);
  });

  test('parses Path attribute', () => {
    const cookies = parseCookies(['id=1; Path=/api'], 'http://example.com');
    assert.strictEqual(cookies[0]!.path, '/api');
  });

  test('parses Domain attribute', () => {
    const cookies = parseCookies(['id=1; Domain=.example.com'], 'http://example.com');
    assert.strictEqual(cookies[0]!.domain, '.example.com');
  });

  test('parses Expires attribute', () => {
    const expires = 'Thu, 01 Jan 2099 00:00:00 GMT';
    const cookies = parseCookies([`id=1; Expires=${expires}`], 'http://example.com');
    assert.ok(cookies[0]!.expires instanceof Date);
    assert.ok(cookies[0]!.expires!.getFullYear() === 2099);
  });

  test('defaults httpOnly and secure to false', () => {
    const cookies = parseCookies(['simple=value'], 'http://example.com');
    assert.strictEqual(cookies[0]!.httpOnly, false);
    assert.strictEqual(cookies[0]!.secure, false);
  });

  test('defaults path to /', () => {
    const cookies = parseCookies(['simple=value'], 'http://example.com');
    assert.strictEqual(cookies[0]!.path, '/');
  });

  test('handles multiple cookies', () => {
    const cookies = parseCookies(
      ['a=1; HttpOnly', 'b=2; Secure'],
      'http://example.com'
    );
    assert.strictEqual(cookies.length, 2);
    assert.strictEqual(cookies[0]!.name, 'a');
    assert.strictEqual(cookies[1]!.name, 'b');
  });

  test('handles empty array', () => {
    const cookies = parseCookies([], 'http://example.com');
    assert.deepStrictEqual(cookies, []);
  });

  test('handles cookie with no value', () => {
    const cookies = parseCookies(['flag'], 'http://example.com');
    assert.strictEqual(cookies[0]!.name, 'flag');
    assert.strictEqual(cookies[0]!.value, '');
  });
});

// ---------------------------------------------------------------------------
// parseResponseBody
// ---------------------------------------------------------------------------

suite('parseResponseBody', () => {
  test('returns string for application/json', () => {
    const buf = Buffer.from('{"ok":true}');
    const result = parseResponseBody(buf, 'application/json');
    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result, '{"ok":true}');
  });

  test('returns string for text/html', () => {
    const buf = Buffer.from('<html></html>');
    const result = parseResponseBody(buf, 'text/html; charset=utf-8');
    assert.strictEqual(typeof result, 'string');
  });

  test('returns string for text/plain', () => {
    const buf = Buffer.from('hello');
    const result = parseResponseBody(buf, 'text/plain');
    assert.strictEqual(result, 'hello');
  });

  test('returns string for application/xml', () => {
    const buf = Buffer.from('<root/>');
    const result = parseResponseBody(buf, 'application/xml');
    assert.strictEqual(typeof result, 'string');
  });

  test('returns Buffer for image/png', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = parseResponseBody(buf, 'image/png');
    assert.ok(Buffer.isBuffer(result));
  });

  test('returns Buffer for application/octet-stream', () => {
    const buf = Buffer.from([0x00, 0x01]);
    const result = parseResponseBody(buf, 'application/octet-stream');
    assert.ok(Buffer.isBuffer(result));
  });

  test('returns Buffer for empty content-type', () => {
    const buf = Buffer.from([0x01]);
    const result = parseResponseBody(buf, '');
    assert.ok(Buffer.isBuffer(result));
  });
});

// ---------------------------------------------------------------------------
// statusText
// ---------------------------------------------------------------------------

suite('statusText', () => {
  test('returns OK for 200', () => {
    assert.strictEqual(statusText(200), 'OK');
  });

  test('returns Created for 201', () => {
    assert.strictEqual(statusText(201), 'Created');
  });

  test('returns Not Found for 404', () => {
    assert.strictEqual(statusText(404), 'Not Found');
  });

  test('returns Internal Server Error for 500', () => {
    assert.strictEqual(statusText(500), 'Internal Server Error');
  });

  test('returns Unknown for unrecognised code', () => {
    assert.strictEqual(statusText(999), 'Unknown');
  });

  test('returns Bad Request for 400', () => {
    assert.strictEqual(statusText(400), 'Bad Request');
  });
});

// ---------------------------------------------------------------------------
// executeHttpRequest - integration tests against a local server
// ---------------------------------------------------------------------------

suite('executeHttpRequest - basic GET', () => {
  let port: number;
  let close: () => Promise<void>;

  setup(async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"hello":"world"}');
    });
    port = srv.port;
    close = srv.close;
  });

  teardown(async () => { await close(); });

  test('resolves with status 200', async () => {
    const req = makeRequest({ url: `http://127.0.0.1:${port}/` });
    const res = await executeHttpRequest(req);
    assert.strictEqual(res.status, 200);
  });

  test('resolves with parsed JSON body as string', async () => {
    const req = makeRequest({ url: `http://127.0.0.1:${port}/` });
    const res = await executeHttpRequest(req);
    assert.strictEqual(res.body, '{"hello":"world"}');
  });

  test('response time is a positive number', async () => {
    const req = makeRequest({ url: `http://127.0.0.1:${port}/` });
    const res = await executeHttpRequest(req);
    assert.ok(res.time >= 0);
  });

  test('response size equals raw body byte length', async () => {
    const req = makeRequest({ url: `http://127.0.0.1:${port}/` });
    const res = await executeHttpRequest(req);
    assert.strictEqual(res.size, Buffer.byteLength('{"hello":"world"}'));
  });

  test('response headers are populated', async () => {
    const req = makeRequest({ url: `http://127.0.0.1:${port}/` });
    const res = await executeHttpRequest(req);
    assert.ok('content-type' in res.headers);
  });
});

suite('executeHttpRequest - HTTP methods', () => {
  let port: number;
  let close: () => Promise<void>;
  let lastMethod: string;

  setup(async () => {
    const srv = await createTestServer((req, res) => {
      lastMethod = req.method ?? '';
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(req.method);
    });
    port = srv.port;
    close = srv.close;
  });

  teardown(async () => { await close(); });

  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const) {
    test(`sends ${method} request`, async () => {
      const req = makeRequest({ method, url: `http://127.0.0.1:${port}/` });
      await executeHttpRequest(req);
      assert.strictEqual(lastMethod, method);
    });
  }
});

suite('executeHttpRequest - query parameters', () => {
  let port: number;
  let close: () => Promise<void>;
  let lastUrl: string;

  setup(async () => {
    const srv = await createTestServer((req, res) => {
      lastUrl = req.url ?? '';
      res.writeHead(200);
      res.end();
    });
    port = srv.port;
    close = srv.close;
  });

  teardown(async () => { await close(); });

  test('appends query params to URL', async () => {
    const req = makeRequest({
      url: `http://127.0.0.1:${port}/search`,
      queryParams: { q: 'hello', page: '2' },
    });
    await executeHttpRequest(req);
    assert.ok(lastUrl.includes('q=hello'));
    assert.ok(lastUrl.includes('page=2'));
  });

  test('merges query params with existing URL params', async () => {
    const req = makeRequest({
      url: `http://127.0.0.1:${port}/search?existing=1`,
      queryParams: { added: 'yes' },
    });
    await executeHttpRequest(req);
    assert.ok(lastUrl.includes('existing=1'));
    assert.ok(lastUrl.includes('added=yes'));
  });
});

suite('executeHttpRequest - request headers', () => {
  let port: number;
  let close: () => Promise<void>;
  let receivedHeaders: http.IncomingHttpHeaders;

  setup(async () => {
    const srv = await createTestServer((req, res) => {
      receivedHeaders = req.headers;
      res.writeHead(200);
      res.end();
    });
    port = srv.port;
    close = srv.close;
  });

  teardown(async () => { await close(); });

  test('sends custom headers', async () => {
    const req = makeRequest({
      url: `http://127.0.0.1:${port}/`,
      headers: { 'X-Custom-Header': 'test-value' },
    });
    await executeHttpRequest(req);
    assert.strictEqual(receivedHeaders['x-custom-header'], 'test-value');
  });

  test('sends Authorization header', async () => {
    const req = makeRequest({
      url: `http://127.0.0.1:${port}/`,
      headers: { Authorization: 'Bearer my-token' },
    });
    await executeHttpRequest(req);
    assert.strictEqual(receivedHeaders['authorization'], 'Bearer my-token');
  });
});

suite('executeHttpRequest - request body', () => {
  let port: number;
  let close: () => Promise<void>;
  let receivedBody: string;
  let receivedContentType: string;

  setup(async () => {
    const srv = await createTestServer((req, res) => {
      receivedContentType = req.headers['content-type'] ?? '';
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString('utf-8');
        res.writeHead(200);
        res.end();
      });
    });
    port = srv.port;
    close = srv.close;
  });

  teardown(async () => { await close(); });

  test('sends JSON body with correct content-type', async () => {
    const req = makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:${port}/`,
      body: { type: 'json', content: '{"name":"test"}' },
    });
    await executeHttpRequest(req);
    assert.ok(receivedContentType.includes('application/json'));
    assert.strictEqual(receivedBody, '{"name":"test"}');
  });

  test('sends x-www-form-urlencoded body', async () => {
    const req = makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:${port}/`,
      body: { type: 'x-www-form-urlencoded', content: 'a=1&b=2' },
    });
    await executeHttpRequest(req);
    assert.ok(receivedContentType.includes('application/x-www-form-urlencoded'));
    assert.strictEqual(receivedBody, 'a=1&b=2');
  });

  test('sends raw text body', async () => {
    const req = makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:${port}/`,
      body: { type: 'raw', content: 'plain text content' },
    });
    await executeHttpRequest(req);
    assert.strictEqual(receivedBody, 'plain text content');
  });

  test('sends GraphQL body as JSON', async () => {
    const gqlPayload = '{"query":"{ users { id } }"}';
    const req = makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:${port}/graphql`,
      body: { type: 'graphql', content: gqlPayload },
    });
    await executeHttpRequest(req);
    assert.ok(receivedContentType.includes('application/json'));
    assert.strictEqual(receivedBody, gqlPayload);
  });

  test('sends form-data body with multipart content-type', async () => {
    const fields: FormDataField[] = [{ name: 'field1', value: 'value1' }];
    const req = makeRequest({
      method: 'POST',
      url: `http://127.0.0.1:${port}/`,
      body: { type: 'form-data', content: fields },
    });
    await executeHttpRequest(req);
    assert.ok(receivedContentType.includes('multipart/form-data'));
    assert.ok(receivedBody.includes('name="field1"'));
    assert.ok(receivedBody.includes('value1'));
  });

  test('does not send body for GET requests', async () => {
    const req = makeRequest({
      method: 'GET',
      url: `http://127.0.0.1:${port}/`,
      body: { type: 'json', content: '{"should":"be ignored"}' },
    });
    await executeHttpRequest(req);
    assert.strictEqual(receivedBody, '');
  });
});

suite('executeHttpRequest - response status codes', () => {
  test('resolves for 404 status (non-2xx does not reject)', async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.statusText, 'Not Found');
    } finally {
      await srv.close();
    }
  });

  test('resolves for 500 status', async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(500);
      res.end('error');
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.strictEqual(res.status, 500);
    } finally {
      await srv.close();
    }
  });

  test('resolves for 201 Created', async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(201);
      res.end();
    });
    try {
      const req = makeRequest({ method: 'POST', url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.strictEqual(res.status, 201);
    } finally {
      await srv.close();
    }
  });
});

suite('executeHttpRequest - cookie extraction', () => {
  test('extracts Set-Cookie headers into cookies array', async () => {
    const srv = await createTestServer((_req, res) => {
      res.setHeader('Set-Cookie', ['session=abc; HttpOnly', 'theme=dark; Secure']);
      res.writeHead(200);
      res.end();
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.strictEqual(res.cookies.length, 2);
      const session = res.cookies.find((c) => c.name === 'session');
      assert.ok(session);
      assert.strictEqual(session!.value, 'abc');
      assert.strictEqual(session!.httpOnly, true);
    } finally {
      await srv.close();
    }
  });

  test('returns empty cookies array when no Set-Cookie header', async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.deepStrictEqual(res.cookies, []);
    } finally {
      await srv.close();
    }
  });
});

suite('executeHttpRequest - error handling', () => {
  test('rejects with error for invalid URL', async () => {
    const req = makeRequest({ url: 'not-a-valid-url' });
    await assert.rejects(() => executeHttpRequest(req), /Invalid URL/);
  });

  test('rejects when connection is refused', async () => {
    // Use a port that is not listening
    const req = makeRequest({ url: 'http://127.0.0.1:1' });
    await assert.rejects(() => executeHttpRequest(req));
  });

  test('rejects on timeout', async () => {
    const srv = await createTestServer((_req, _res) => {
      // Never respond - simulates timeout
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      await assert.rejects(() => executeHttpRequest(req, 50), /timed out/i);
    } finally {
      await srv.close();
    }
  });
});

suite('executeHttpRequest - response size tracking', () => {
  test('size reflects actual byte length of response body', async () => {
    const body = 'a'.repeat(1000);
    const srv = await createTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(body);
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.strictEqual(res.size, 1000);
    } finally {
      await srv.close();
    }
  });

  test('size is 0 for empty response body', async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.strictEqual(res.size, 0);
    } finally {
      await srv.close();
    }
  });
});

suite('executeHttpRequest - response time tracking', () => {
  test('time is measured in milliseconds and is non-negative', async () => {
    const srv = await createTestServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });
    try {
      const req = makeRequest({ url: `http://127.0.0.1:${srv.port}/` });
      const res = await executeHttpRequest(req);
      assert.ok(typeof res.time === 'number');
      assert.ok(res.time >= 0);
    } finally {
      await srv.close();
    }
  });
});
