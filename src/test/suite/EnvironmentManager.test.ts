import * as assert from 'assert';
import { EnvironmentManager, Variable } from '../../managers/EnvironmentManager';
import { VariableResolver, VariableContext } from '../../managers/VariableResolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVar(key: string, value: string, type: 'default' | 'secret' = 'default'): Variable {
  return { key, value, type, enabled: true };
}

// ---------------------------------------------------------------------------
// 4.1.1 / 4.1.2 – Environment creation and deletion
// ---------------------------------------------------------------------------

suite('EnvironmentManager - createEnvironment', () => {
  test('creates environment with given name', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Development');
    assert.strictEqual(env.name, 'Development');
  });

  test('assigns unique non-empty id', () => {
    const em = new EnvironmentManager();
    const a = em.createEnvironment('A');
    const b = em.createEnvironment('B');
    assert.ok(a.id.length > 0);
    assert.notStrictEqual(a.id, b.id);
  });

  test('initialises with empty variables array', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Empty');
    assert.deepStrictEqual(env.variables, []);
  });

  test('environment appears in getEnvironments()', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Listed');
    assert.ok(em.getEnvironments().some((e) => e.id === env.id));
  });
});

suite('EnvironmentManager - deleteEnvironment', () => {
  test('removes environment from list', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('ToDelete');
    em.deleteEnvironment(env.id);
    assert.strictEqual(em.getEnvironments().length, 0);
  });

  test('returns true when environment exists', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('X');
    assert.strictEqual(em.deleteEnvironment(env.id), true);
  });

  test('returns false for non-existent environment', () => {
    const em = new EnvironmentManager();
    assert.strictEqual(em.deleteEnvironment('ghost'), false);
  });

  test('clears active environment if deleted', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Active');
    em.setActiveEnvironment(env.id);
    em.deleteEnvironment(env.id);
    assert.strictEqual(em.getActiveEnvironment(), null);
  });
});

// ---------------------------------------------------------------------------
// 4.1.3 – Variable CRUD operations
// ---------------------------------------------------------------------------

suite('EnvironmentManager - setVariable / getVariable', () => {
  test('adds a variable to an environment', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setVariable(env.id, makeVar('baseUrl', 'http://localhost'));
    assert.strictEqual(em.getVariable(env.id, 'baseUrl'), 'http://localhost');
  });

  test('updates existing variable with same key', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setVariable(env.id, makeVar('baseUrl', 'http://localhost'));
    em.setVariable(env.id, makeVar('baseUrl', 'http://staging.example.com'));
    assert.strictEqual(em.getVariable(env.id, 'baseUrl'), 'http://staging.example.com');
    assert.strictEqual(env.variables.length, 1);
  });

  test('returns undefined for unknown key', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    assert.strictEqual(em.getVariable(env.id, 'missing'), undefined);
  });

  test('returns undefined for disabled variable', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setVariable(env.id, { key: 'token', value: 'abc', type: 'default', enabled: false });
    assert.strictEqual(em.getVariable(env.id, 'token'), undefined);
  });

  test('throws for unknown environment id', () => {
    const em = new EnvironmentManager();
    assert.throws(() => em.setVariable('ghost', makeVar('k', 'v')), /not found/i);
  });
});

suite('EnvironmentManager - deleteVariable', () => {
  test('removes variable from environment', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setVariable(env.id, makeVar('token', 'abc'));
    em.deleteVariable(env.id, 'token');
    assert.strictEqual(em.getVariable(env.id, 'token'), undefined);
  });

  test('returns true when variable exists', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setVariable(env.id, makeVar('token', 'abc'));
    assert.strictEqual(em.deleteVariable(env.id, 'token'), true);
  });

  test('returns false for unknown key', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    assert.strictEqual(em.deleteVariable(env.id, 'ghost'), false);
  });
});

// ---------------------------------------------------------------------------
// 4.1.4 – Active environment switching
// ---------------------------------------------------------------------------

suite('EnvironmentManager - setActiveEnvironment', () => {
  test('sets the active environment', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setActiveEnvironment(env.id);
    assert.strictEqual(em.getActiveEnvironment()?.id, env.id);
  });

  test('throws for unknown environment id', () => {
    const em = new EnvironmentManager();
    assert.throws(() => em.setActiveEnvironment('ghost'), /not found/i);
  });

  test('clearActiveEnvironment sets active to null', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setActiveEnvironment(env.id);
    em.clearActiveEnvironment();
    assert.strictEqual(em.getActiveEnvironment(), null);
  });

  test('switching environments updates active', () => {
    const em = new EnvironmentManager();
    const dev = em.createEnvironment('Dev');
    const prod = em.createEnvironment('Prod');
    em.setActiveEnvironment(dev.id);
    em.setActiveEnvironment(prod.id);
    assert.strictEqual(em.getActiveEnvironment()?.id, prod.id);
  });
});

// ---------------------------------------------------------------------------
// 4.1.5 – Global variables management
// ---------------------------------------------------------------------------

suite('EnvironmentManager - global variables', () => {
  test('sets and gets a global variable', () => {
    const em = new EnvironmentManager();
    em.setGlobalVariable(makeVar('apiVersion', 'v2'));
    assert.strictEqual(em.getGlobalVariable('apiVersion'), 'v2');
  });

  test('updates existing global variable', () => {
    const em = new EnvironmentManager();
    em.setGlobalVariable(makeVar('apiVersion', 'v1'));
    em.setGlobalVariable(makeVar('apiVersion', 'v2'));
    assert.strictEqual(em.getGlobalVariable('apiVersion'), 'v2');
    assert.strictEqual(em.getGlobalVariables().length, 1);
  });

  test('returns undefined for unknown global key', () => {
    const em = new EnvironmentManager();
    assert.strictEqual(em.getGlobalVariable('missing'), undefined);
  });

  test('deleteGlobalVariable removes the variable', () => {
    const em = new EnvironmentManager();
    em.setGlobalVariable(makeVar('key', 'val'));
    em.deleteGlobalVariable('key');
    assert.strictEqual(em.getGlobalVariable('key'), undefined);
  });

  test('deleteGlobalVariable returns false for unknown key', () => {
    const em = new EnvironmentManager();
    assert.strictEqual(em.deleteGlobalVariable('ghost'), false);
  });
});

// ---------------------------------------------------------------------------
// 4.1.6 – Secret variable masking in UI
// ---------------------------------------------------------------------------

suite('EnvironmentManager - secret masking', () => {
  test('maskSecretForDisplay masks secret variable value', () => {
    const em = new EnvironmentManager();
    const masked = em.maskSecretForDisplay({ key: 'token', value: 'super-secret', type: 'secret', enabled: true });
    assert.strictEqual(masked.value, '****');
  });

  test('maskSecretForDisplay does not mask default variable', () => {
    const em = new EnvironmentManager();
    const masked = em.maskSecretForDisplay({ key: 'url', value: 'http://localhost', type: 'default', enabled: true });
    assert.strictEqual(masked.value, 'http://localhost');
  });

  test('getVariablesForDisplay masks secret values', () => {
    const em = new EnvironmentManager();
    const env = em.createEnvironment('Dev');
    em.setVariable(env.id, { key: 'token', value: 'real-secret', type: 'secret', enabled: true });
    em.setVariable(env.id, makeVar('url', 'http://localhost'));
    const display = em.getVariablesForDisplay(env.id);
    const tokenVar = display.find((v) => v.key === 'token');
    const urlVar = display.find((v) => v.key === 'url');
    assert.strictEqual(tokenVar?.value, '****');
    assert.strictEqual(urlVar?.value, 'http://localhost');
  });

  test('getGlobalVariablesForDisplay masks secret global variables', () => {
    const em = new EnvironmentManager();
    em.setGlobalVariable({ key: 'secret', value: 'hidden', type: 'secret', enabled: true });
    const display = em.getGlobalVariablesForDisplay();
    assert.strictEqual(display[0]?.value, '****');
  });
});

// ---------------------------------------------------------------------------
// 4.2.1 / 4.2.2 – Variable resolution with precedence
// ---------------------------------------------------------------------------

suite('VariableResolver - basic resolution', () => {
  test('resolves a simple variable placeholder', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      environmentVariables: [makeVar('baseUrl', 'http://api.example.com')],
    };
    assert.strictEqual(vr.resolve('{{baseUrl}}/users', ctx), 'http://api.example.com/users');
  });

  test('leaves unresolved placeholders as-is', () => {
    const vr = new VariableResolver();
    assert.strictEqual(vr.resolve('{{unknown}}', {}), '{{unknown}}');
  });

  test('resolves multiple placeholders in one string', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      environmentVariables: [makeVar('host', 'api.example.com'), makeVar('version', 'v2')],
    };
    assert.strictEqual(vr.resolve('https://{{host}}/{{version}}/users', ctx), 'https://api.example.com/v2/users');
  });

  test('returns text unchanged when no placeholders', () => {
    const vr = new VariableResolver();
    assert.strictEqual(vr.resolve('https://api.example.com', {}), 'https://api.example.com');
  });
});

suite('VariableResolver - precedence rules', () => {
  test('local overrides environment variable', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      environmentVariables: [makeVar('token', 'env-token')],
      localVariables: [makeVar('token', 'local-token')],
    };
    assert.strictEqual(vr.resolve('{{token}}', ctx), 'local-token');
  });

  test('environment overrides collection variable', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      collectionVariables: [makeVar('baseUrl', 'collection-url')],
      environmentVariables: [makeVar('baseUrl', 'env-url')],
    };
    assert.strictEqual(vr.resolve('{{baseUrl}}', ctx), 'env-url');
  });

  test('collection overrides global variable', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      globalVariables: [makeVar('baseUrl', 'global-url')],
      collectionVariables: [makeVar('baseUrl', 'collection-url')],
    };
    assert.strictEqual(vr.resolve('{{baseUrl}}', ctx), 'collection-url');
  });

  test('iteration data overrides environment variable', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      environmentVariables: [makeVar('userId', '1')],
      iterationData: { userId: '42' },
    };
    assert.strictEqual(vr.resolve('{{userId}}', ctx), '42');
  });

  test('disabled variable is skipped in resolution', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      environmentVariables: [{ key: 'token', value: 'disabled-val', type: 'default', enabled: false }],
      globalVariables: [makeVar('token', 'global-val')],
    };
    assert.strictEqual(vr.resolve('{{token}}', ctx), 'global-val');
  });
});

// ---------------------------------------------------------------------------
// 4.2.3 – Recursive variable resolution
// ---------------------------------------------------------------------------

suite('VariableResolver - recursive resolution', () => {
  test('resolves variable whose value contains another placeholder', () => {
    const vr = new VariableResolver();
    const ctx: VariableContext = {
      environmentVariables: [
        makeVar('host', 'api.example.com'),
        makeVar('baseUrl', 'https://{{host}}'),
      ],
    };
    assert.strictEqual(vr.resolve('{{baseUrl}}/users', ctx), 'https://api.example.com/users');
  });

  test('stops recursion at MAX_DEPTH to prevent infinite loops', () => {
    const vr = new VariableResolver();
    // a -> {{b}}, b -> {{a}} (circular)
    const ctx: VariableContext = {
      environmentVariables: [makeVar('a', '{{b}}'), makeVar('b', '{{a}}')],
    };
    // Should not throw and should return something (not infinite loop)
    const result = vr.resolve('{{a}}', ctx);
    assert.ok(typeof result === 'string');
  });
});

// ---------------------------------------------------------------------------
// 4.2.4 – Dynamic variable generation
// ---------------------------------------------------------------------------

suite('VariableResolver - dynamic variables', () => {
  test('$timestamp returns a numeric string', () => {
    const vr = new VariableResolver();
    const result = vr.resolve('{{$timestamp}}', {});
    assert.ok(/^\d+$/.test(result), `Expected numeric string, got: ${result}`);
  });

  test('$randomInt returns a number between 0 and 1000', () => {
    const vr = new VariableResolver();
    const result = parseInt(vr.resolve('{{$randomInt}}', {}), 10);
    assert.ok(!isNaN(result));
    assert.ok(result >= 0 && result <= 1000);
  });

  test('$guid returns a valid UUID v4 format', () => {
    const vr = new VariableResolver();
    const result = vr.resolve('{{$guid}}', {});
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result),
      `Expected UUID v4, got: ${result}`);
  });

  test('$randomString returns a 10-character alphanumeric string', () => {
    const vr = new VariableResolver();
    const result = vr.resolve('{{$randomString}}', {});
    assert.ok(/^[A-Za-z0-9]{10}$/.test(result), `Expected 10-char alphanumeric, got: ${result}`);
  });

  test('each $guid call returns a different value', () => {
    const vr = new VariableResolver();
    const a = vr.resolve('{{$guid}}', {});
    const b = vr.resolve('{{$guid}}', {});
    assert.notStrictEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// 4.2.5 – Faker.js integration
// ---------------------------------------------------------------------------

suite('VariableResolver - faker integration', () => {
  test('$faker.name.firstName returns a non-empty string', () => {
    const vr = new VariableResolver();
    const result = vr.resolve('{{$faker.name.firstName}}', {});
    assert.ok(result.length > 0);
    assert.ok(!result.startsWith('{{'));
  });

  test('unknown faker path returns placeholder as-is', () => {
    const vr = new VariableResolver();
    const result = vr.resolve('{{$faker.nonexistent.method}}', {});
    assert.ok(result.includes('faker'));
  });
});

// ---------------------------------------------------------------------------
// 4.2.6 – Resolve in URL, headers, body
// ---------------------------------------------------------------------------

suite('VariableResolver - resolveUrl / resolveHeaders / resolveBody', () => {
  const ctx: VariableContext = {
    environmentVariables: [makeVar('baseUrl', 'https://api.example.com'), makeVar('token', 'abc123')],
  };

  test('resolveUrl resolves placeholders in URL', () => {
    const vr = new VariableResolver();
    assert.strictEqual(vr.resolveUrl('{{baseUrl}}/users', ctx), 'https://api.example.com/users');
  });

  test('resolveHeaders resolves placeholders in header values', () => {
    const vr = new VariableResolver();
    const headers = { Authorization: 'Bearer {{token}}', 'Content-Type': 'application/json' };
    const resolved = vr.resolveHeaders(headers, ctx);
    assert.strictEqual(resolved['Authorization'], 'Bearer abc123');
    assert.strictEqual(resolved['Content-Type'], 'application/json');
  });

  test('resolveBody resolves placeholders in body string', () => {
    const vr = new VariableResolver();
    const body = '{"url": "{{baseUrl}}", "token": "{{token}}"}';
    const resolved = vr.resolveBody(body, ctx);
    assert.strictEqual(resolved, '{"url": "https://api.example.com", "token": "abc123"}');
  });

  test('resolveHeaders returns new object without mutating original', () => {
    const vr = new VariableResolver();
    const headers = { Authorization: 'Bearer {{token}}' };
    const resolved = vr.resolveHeaders(headers, ctx);
    assert.strictEqual(headers['Authorization'], 'Bearer {{token}}');
    assert.strictEqual(resolved['Authorization'], 'Bearer abc123');
  });
});
