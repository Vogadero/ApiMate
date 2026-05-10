/**
 * Tests for ScriptEngine – pm API, test assertions, and error handling.
 * Requirements 8 & 9.
 */
import * as assert from 'assert';
import { ScriptEngine, ScriptContext } from '../../managers/ScriptEngine';
import { EnvironmentManager } from '../../managers/EnvironmentManager';
import { HttpRequest, HttpResponse } from '../../managers/RequestManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal stub for vscode.ExtensionContext */
function makeContext(): any {
  return {
    subscriptions: [],
    globalState: { get: () => undefined, update: async () => {} },
    workspaceState: { get: () => undefined, update: async () => {} },
    secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
    extensionPath: '',
    extensionUri: { fsPath: '' },
  };
}

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    id: 'req-1',
    name: 'Test',
    method: 'GET',
    url: 'http://example.com',
    headers: {},
    queryParams: {},
    ...overrides,
  };
}

function makeResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"message":"hello"}',
    time: 42,
    size: 19,
    cookies: [],
    ...overrides,
  };
}

function makeScriptContext(overrides: Partial<ScriptContext> = {}): ScriptContext {
  return {
    request: makeRequest(),
    environment: new EnvironmentManager(),
    ...overrides,
  };
}

function makeEngine(): ScriptEngine {
  return new ScriptEngine(makeContext());
}

// ---------------------------------------------------------------------------
// Pre-request script – basic execution
// ---------------------------------------------------------------------------

suite('ScriptEngine – executePreRequestScript', () => {
  test('resolves without error for empty script', async () => {
    const engine = makeEngine();
    await engine.executePreRequestScript('', makeScriptContext());
  });

  test('resolves without error for whitespace-only script', async () => {
    const engine = makeEngine();
    await engine.executePreRequestScript('   \n  ', makeScriptContext());
  });

  test('executes valid JavaScript without throwing', async () => {
    const engine = makeEngine();
    await engine.executePreRequestScript('const x = 1 + 1;', makeScriptContext());
  });

  test('rejects on syntax error', async () => {
    const engine = makeEngine();
    await assert.rejects(
      () => engine.executePreRequestScript('this is not valid js !!!', makeScriptContext()),
    );
  });

  test('rejects on runtime error', async () => {
    const engine = makeEngine();
    await assert.rejects(
      () => engine.executePreRequestScript('throw new Error("boom");', makeScriptContext()),
    );
  });
});

// ---------------------------------------------------------------------------
// Post-request script – returns TestResult[]
// ---------------------------------------------------------------------------

suite('ScriptEngine – executePostRequestScript', () => {
  test('returns empty array for empty script', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript('', makeScriptContext());
    assert.deepStrictEqual(results, []);
  });

  test('returns empty array when no pm.test() calls', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript('const x = 42;', makeScriptContext());
    assert.deepStrictEqual(results, []);
  });

  test('returns failed test result on script error', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      'throw new Error("script failed");',
      makeScriptContext()
    );
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.passed, false);
    assert.ok(results[0]!.error?.includes('script failed'));
  });
});

// ---------------------------------------------------------------------------
// pm.test() – test registration
// ---------------------------------------------------------------------------

suite('ScriptEngine – pm.test()', () => {
  test('passing test is recorded as passed', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('always passes', function() { pm.expect(1).to.equal(1); });`,
      makeScriptContext()
    );
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.name, 'always passes');
    assert.strictEqual(results[0]!.passed, true);
    assert.strictEqual(results[0]!.error, undefined);
  });

  test('failing test is recorded as failed with error message', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('always fails', function() { pm.expect(1).to.equal(2); });`,
      makeScriptContext()
    );
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]!.name, 'always fails');
    assert.strictEqual(results[0]!.passed, false);
    assert.ok(results[0]!.error && results[0]!.error.length > 0);
  });

  test('multiple tests are all recorded', async () => {
    const engine = makeEngine();
    const script = `
      pm.test('test one', function() { pm.expect(true).to.be.true; });
      pm.test('test two', function() { pm.expect(false).to.be.true; });
      pm.test('test three', function() { pm.expect('hello').to.equal('hello'); });
    `;
    const results = await engine.executePostRequestScript(script, makeScriptContext());
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0]!.passed, true);
    assert.strictEqual(results[1]!.passed, false);
    assert.strictEqual(results[2]!.passed, true);
  });

  test('test name is preserved in result', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('my custom test name', function() {});`,
      makeScriptContext()
    );
    assert.strictEqual(results[0]!.name, 'my custom test name');
  });

  test('subsequent tests run even after a failing test', async () => {
    const engine = makeEngine();
    const script = `
      pm.test('fail', function() { pm.expect(1).to.equal(99); });
      pm.test('pass', function() { pm.expect(1).to.equal(1); });
    `;
    const results = await engine.executePostRequestScript(script, makeScriptContext());
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0]!.passed, false);
    assert.strictEqual(results[1]!.passed, true);
  });
});

// ---------------------------------------------------------------------------
// pm.expect() – Chai assertions
// ---------------------------------------------------------------------------

suite('ScriptEngine – pm.expect() Chai assertions', () => {
  test('pm.expect(value).to.equal() passes for equal values', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('eq', function() { pm.expect(42).to.equal(42); });`,
      makeScriptContext()
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.expect(value).to.be.true passes for true', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('true', function() { pm.expect(true).to.be.true; });`,
      makeScriptContext()
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.expect(value).to.include() works for strings', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('include', function() { pm.expect('hello world').to.include('world'); });`,
      makeScriptContext()
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.expect(value).to.have.property() works for objects', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('prop', function() { pm.expect({a: 1}).to.have.property('a'); });`,
      makeScriptContext()
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.expect(value).to.be.above() works for numbers', async () => {
    const engine = makeEngine();
    const results = await engine.executePostRequestScript(
      `pm.test('above', function() { pm.expect(10).to.be.above(5); });`,
      makeScriptContext()
    );
    assert.strictEqual(results[0]!.passed, true);
  });
});

// ---------------------------------------------------------------------------
// pm.response – response access
// ---------------------------------------------------------------------------

suite('ScriptEngine – pm.response', () => {
  test('pm.response.status is accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({ response: makeResponse({ status: 201 }) });
    const results = await engine.executePostRequestScript(
      `pm.test('status', function() { pm.expect(pm.response.status).to.equal(201); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.response.body is parsed JSON when content-type is json', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({
      response: makeResponse({ body: '{"message":"hello"}' }),
    });
    const results = await engine.executePostRequestScript(
      `pm.test('body', function() { pm.expect(pm.response.body.message).to.equal('hello'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.response.headers are accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({
      response: makeResponse({ headers: { 'x-custom': 'value123' } }),
    });
    const results = await engine.executePostRequestScript(
      `pm.test('headers', function() { pm.expect(pm.response.headers['x-custom']).to.equal('value123'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.response.responseTime is accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({ response: makeResponse({ time: 123 }) });
    const results = await engine.executePostRequestScript(
      `pm.test('time', function() { pm.expect(pm.response.responseTime).to.equal(123); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.response.responseSize is accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({ response: makeResponse({ size: 512 }) });
    const results = await engine.executePostRequestScript(
      `pm.test('size', function() { pm.expect(pm.response.responseSize).to.equal(512); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.response is undefined in pre-request script context', async () => {
    const engine = makeEngine();
    // No response in context – pm.response should be undefined
    const ctx = makeScriptContext(); // no response
    await engine.executePreRequestScript(
      `if (pm.response !== undefined) { throw new Error('response should be undefined'); }`,
      ctx
    );
  });
});

// ---------------------------------------------------------------------------
// pm.request – request access
// ---------------------------------------------------------------------------

suite('ScriptEngine – pm.request', () => {
  test('pm.request.url is accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({ request: makeRequest({ url: 'http://test.com/api' }) });
    const results = await engine.executePostRequestScript(
      `pm.test('url', function() { pm.expect(pm.request.url).to.equal('http://test.com/api'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.request.method is accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({ request: makeRequest({ method: 'POST' }) });
    const results = await engine.executePostRequestScript(
      `pm.test('method', function() { pm.expect(pm.request.method).to.equal('POST'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.request.headers are accessible', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({
      request: makeRequest({ headers: { Authorization: 'Bearer token' } }),
    });
    const results = await engine.executePostRequestScript(
      `pm.test('headers', function() { pm.expect(pm.request.headers['Authorization']).to.equal('Bearer token'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });
});

// ---------------------------------------------------------------------------
// pm.environment – environment variable access
// ---------------------------------------------------------------------------

suite('ScriptEngine – pm.environment', () => {
  test('pm.environment.set() and get() round-trip', async () => {
    const engine = makeEngine();
    const envManager = new EnvironmentManager();
    const env = envManager.createEnvironment('test');
    envManager.setActiveEnvironment(env.id);
    const ctx = makeScriptContext({ environment: envManager });

    await engine.executePreRequestScript(
      `pm.environment.set('myKey', 'myValue');`,
      ctx
    );

    const value = envManager.getVariable(env.id, 'myKey');
    assert.strictEqual(value, 'myValue');
  });

  test('pm.environment.get() retrieves existing variable', async () => {
    const engine = makeEngine();
    const envManager = new EnvironmentManager();
    const env = envManager.createEnvironment('test');
    envManager.setVariable(env.id, { key: 'token', value: 'abc123', type: 'default', enabled: true });
    envManager.setActiveEnvironment(env.id);
    const ctx = makeScriptContext({ environment: envManager });

    const results = await engine.executePostRequestScript(
      `pm.test('env get', function() { pm.expect(pm.environment.get('token')).to.equal('abc123'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.environment.get() returns undefined for missing key', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext({ environment: new EnvironmentManager() });
    const results = await engine.executePostRequestScript(
      `pm.test('missing', function() { pm.expect(pm.environment.get('nonexistent')).to.be.undefined; });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });
});

// ---------------------------------------------------------------------------
// pm.variables – local variable store
// ---------------------------------------------------------------------------

suite('ScriptEngine – pm.variables', () => {
  test('pm.variables.set() and get() round-trip', async () => {
    const engine = makeEngine();
    const localVars = new Map<string, string>();
    const ctx = makeScriptContext({ localVariables: localVars });

    await engine.executePreRequestScript(
      `pm.variables.set('localKey', 'localValue');`,
      ctx
    );

    assert.strictEqual(localVars.get('localKey'), 'localValue');
  });

  test('pm.variables.get() retrieves set variable', async () => {
    const engine = makeEngine();
    const localVars = new Map<string, string>([['foo', 'bar']]);
    const ctx = makeScriptContext({ localVariables: localVars });

    const results = await engine.executePostRequestScript(
      `pm.test('local get', function() { pm.expect(pm.variables.get('foo')).to.equal('bar'); });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });

  test('pm.variables.get() returns undefined for missing key', async () => {
    const engine = makeEngine();
    const ctx = makeScriptContext();
    const results = await engine.executePostRequestScript(
      `pm.test('missing local', function() { pm.expect(pm.variables.get('nope')).to.be.undefined; });`,
      ctx
    );
    assert.strictEqual(results[0]!.passed, true);
  });
});

// ---------------------------------------------------------------------------
// Sandbox isolation
// ---------------------------------------------------------------------------

suite('ScriptEngine – sandbox isolation', () => {
  test('script cannot access process object', async () => {
    const engine = makeEngine();
    // vm2 should prevent access to process
    await assert.rejects(
      () =>
        engine.executePreRequestScript(
          `if (typeof process !== 'undefined') { process.exit(1); }`,
          makeScriptContext()
        )
    );
  });

  test('script cannot access require()', async () => {
    const engine = makeEngine();
    await assert.rejects(
      () =>
        engine.executePreRequestScript(
          `require('fs').readFileSync('/etc/passwd');`,
          makeScriptContext()
        )
    );
  });
});

// ---------------------------------------------------------------------------
// console redirection
// ---------------------------------------------------------------------------

suite('ScriptEngine – console redirection', () => {
  test('console.log does not throw', async () => {
    const engine = makeEngine();
    await engine.executePreRequestScript(
      `console.log('hello from script');`,
      makeScriptContext()
    );
  });

  test('console.warn does not throw', async () => {
    const engine = makeEngine();
    await engine.executePreRequestScript(
      `console.warn('warning from script');`,
      makeScriptContext()
    );
  });

  test('console.error does not throw', async () => {
    const engine = makeEngine();
    await engine.executePreRequestScript(
      `console.error('error from script');`,
      makeScriptContext()
    );
  });
});
