import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageManager, Environment } from '../../managers/StorageManager';
import { Collection } from '../../managers/CollectionManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'apimate-test-'));
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Minimal mock for vscode.ExtensionContext */
function createMockContext(workspacePath: string): any {
  const secrets: Record<string, string> = {};
  return {
    subscriptions: [],
    secrets: {
      async store(key: string, value: string) {
        secrets[key] = value;
      },
      async get(key: string): Promise<string | undefined> {
        return secrets[key];
      },
      async delete(key: string) {
        delete secrets[key];
      },
    },
    _secrets: secrets,
    _workspacePath: workspacePath,
  };
}

/** Patch vscode.workspace.workspaceFolders to return a temp directory */
function withWorkspace(tmpDir: string, fn: () => void): void {
  const vscode = require('vscode');
  const original = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    get: () => [{ uri: { fsPath: tmpDir } }],
    configurable: true,
  });
  try {
    fn();
  } finally {
    if (original) {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', original);
    }
  }
}

function makeCollection(id: string, name: string): Collection {
  return { id, name, folders: [], requests: [], variables: [] };
}

function makeEnvironment(id: string, name: string): Environment {
  return {
    id,
    name,
    variables: [{ key: 'baseUrl', value: 'http://localhost', type: 'default', enabled: true }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('StorageManager - directory initialisation', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('creates .vscode/apimate/collections and environments directories on construction', () => {
    withWorkspace(tmpDir, () => {
      const ctx = createMockContext(tmpDir);
      new StorageManager(ctx);

      assert.ok(fs.existsSync(path.join(tmpDir, '.vscode', 'apimate', 'collections')));
      assert.ok(fs.existsSync(path.join(tmpDir, '.vscode', 'apimate', 'environments')));
    });
  });

  test('does not throw if directories already exist', () => {
    withWorkspace(tmpDir, () => {
      const ctx = createMockContext(tmpDir);
      assert.doesNotThrow(() => {
        new StorageManager(ctx);
        new StorageManager(ctx); // second construction - dirs already exist
      });
    });
  });
});

suite('StorageManager - saveCollection / loadCollections', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('saveCollection writes a JSON file named <id>.json', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      const col = makeCollection('col-1', 'My Collection');

      await sm.saveCollection(col);

      const filePath = path.join(tmpDir, '.vscode', 'apimate', 'collections', 'col-1.json');
      assert.ok(fs.existsSync(filePath), 'collection file should exist');
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.strictEqual(parsed.id, 'col-1');
      assert.strictEqual(parsed.name, 'My Collection');
    });
  });

  test('loadCollections returns empty array when no files exist', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      const result = await sm.loadCollections();
      assert.deepStrictEqual(result, []);
    });
  });

  test('loadCollections returns all saved collections', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveCollection(makeCollection('c1', 'Alpha'));
      await sm.saveCollection(makeCollection('c2', 'Beta'));

      const result = await sm.loadCollections();
      assert.strictEqual(result.length, 2);
      const names = result.map((c) => c.name).sort();
      assert.deepStrictEqual(names, ['Alpha', 'Beta']);
    });
  });

  test('loadCollections skips non-JSON files', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      // Write a non-JSON file into the collections directory
      fs.writeFileSync(path.join(sm.collectionPath, 'readme.txt'), 'ignore me');
      await sm.saveCollection(makeCollection('c1', 'Real'));

      const result = await sm.loadCollections();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Real');
    });
  });

  test('loadCollections skips malformed JSON files without throwing', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      fs.writeFileSync(path.join(sm.collectionPath, 'bad.json'), '{ not valid json }');
      await sm.saveCollection(makeCollection('c1', 'Good'));

      const result = await sm.loadCollections();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'c1');
    });
  });

  test('saveCollection overwrites existing file on update', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const col = makeCollection('c1', 'Original');
      await sm.saveCollection(col);

      const updated = { ...col, name: 'Updated' };
      await sm.saveCollection(updated);

      const result = await sm.loadCollections();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Updated');
    });
  });
});

suite('StorageManager - versioned collection file format', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('saved collection file contains version field "1.0"', async () => {
    withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      await sm.saveCollection(makeCollection('v1', 'Versioned'));

      const filePath = path.join(sm.collectionPath, 'v1.json');
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.strictEqual(parsed.version, '1.0');
    });
  });

  test('all Collection fields are serialized and deserialized correctly', async () => {
    withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const col: Collection = {
        id: 'full-col',
        name: 'Full Collection',
        folders: [{ id: 'f1', name: 'Folder 1', folders: [], requests: [] }],
        requests: [
          {
            id: 'r1',
            name: 'Get Users',
            method: 'GET' as any,
            url: '{{baseUrl}}/users',
            headers: { Authorization: 'Bearer {{token}}' },
            queryParams: { page: '1' },
          },
        ],
        variables: [{ key: 'baseUrl', value: 'https://api.example.com', type: 'default', enabled: true }],
        auth: { type: 'bearer', config: { token: '{{token}}' } },
        preRequestScript: 'pm.environment.set("ts", Date.now());',
        postRequestScript: 'pm.test("ok", () => {});',
      };

      await sm.saveCollection(col);
      const loaded = await sm.loadCollections();

      assert.strictEqual(loaded.length, 1);
      const lc = loaded[0];
      assert.strictEqual(lc.id, col.id);
      assert.strictEqual(lc.name, col.name);
      assert.strictEqual(lc.folders.length, 1);
      assert.strictEqual(lc.folders[0].id, 'f1');
      assert.strictEqual(lc.requests.length, 1);
      assert.strictEqual(lc.requests[0].id, 'r1');
      assert.strictEqual(lc.variables.length, 1);
      assert.strictEqual(lc.variables[0].key, 'baseUrl');
      assert.deepStrictEqual(lc.auth, col.auth);
      assert.strictEqual(lc.preRequestScript, col.preRequestScript);
      assert.strictEqual(lc.postRequestScript, col.postRequestScript);
    });
  });

  test('optional fields (auth, scripts) are omitted when not set', async () => {
    withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveCollection(makeCollection('bare', 'Bare'));

      const filePath = path.join(sm.collectionPath, 'bare.json');
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.ok(!('auth' in parsed), 'auth should not be present');
      assert.ok(!('preRequestScript' in parsed), 'preRequestScript should not be present');
      assert.ok(!('postRequestScript' in parsed), 'postRequestScript should not be present');
    });
  });
});

suite('StorageManager - deleteCollection', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('deleteCollection removes the collection file', async () => {
    withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveCollection(makeCollection('del-1', 'To Delete'));
      const filePath = path.join(sm.collectionPath, 'del-1.json');
      assert.ok(fs.existsSync(filePath), 'file should exist before deletion');

      await sm.deleteCollection('del-1');
      assert.ok(!fs.existsSync(filePath), 'file should be removed after deletion');
    });
  });

  test('deleteCollection is idempotent for non-existent collections', async () => {
    withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await assert.doesNotReject(() => sm.deleteCollection('ghost-id'));
    });
  });

  test('deleted collection is not returned by loadCollections', async () => {
    withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveCollection(makeCollection('keep', 'Keep'));
      await sm.saveCollection(makeCollection('remove', 'Remove'));
      await sm.deleteCollection('remove');

      const result = await sm.loadCollections();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'keep');
    });
  });
});

suite('StorageManager - saveEnvironment / loadEnvironments', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('saveEnvironment writes a JSON file named <id>.json', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      const env = makeEnvironment('env-1', 'Development');

      await sm.saveEnvironment(env);

      const filePath = path.join(tmpDir, '.vscode', 'apimate', 'environments', 'env-1.json');
      assert.ok(fs.existsSync(filePath));
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.strictEqual(parsed.id, 'env-1');
      assert.strictEqual(parsed.name, 'Development');
    });
  });

  test('loadEnvironments returns empty array when no files exist', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      const result = await sm.loadEnvironments();
      assert.deepStrictEqual(result, []);
    });
  });

  test('loadEnvironments returns all saved environments', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveEnvironment(makeEnvironment('e1', 'Dev'));
      await sm.saveEnvironment(makeEnvironment('e2', 'Prod'));

      const result = await sm.loadEnvironments();
      assert.strictEqual(result.length, 2);
      const names = result.map((e) => e.name).sort();
      assert.deepStrictEqual(names, ['Dev', 'Prod']);
    });
  });

  test('loadEnvironments skips malformed JSON files without throwing', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      fs.writeFileSync(path.join(sm.environmentPath, 'bad.json'), 'not json');
      await sm.saveEnvironment(makeEnvironment('e1', 'Good'));

      const result = await sm.loadEnvironments();
      assert.strictEqual(result.length, 1);
    });
  });
});

suite('StorageManager - secret storage', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('saveSecret and getSecret round-trip', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveSecret('my-token', 'super-secret-value');
      const result = await sm.getSecret('my-token');

      assert.strictEqual(result, 'super-secret-value');
    });
  });

  test('getSecret returns undefined for unknown key', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const result = await sm.getSecret('nonexistent');
      assert.strictEqual(result, undefined);
    });
  });

  test('deleteSecret removes the secret', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveSecret('token', 'value');
      await sm.deleteSecret('token');
      const result = await sm.getSecret('token');

      assert.strictEqual(result, undefined);
    });
  });

  test('deleteSecret on non-existent key does not throw', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await assert.doesNotReject(() => sm.deleteSecret('ghost-key'));
    });
  });

  test('multiple secrets are stored independently', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveSecret('key-a', 'value-a');
      await sm.saveSecret('key-b', 'value-b');

      assert.strictEqual(await sm.getSecret('key-a'), 'value-a');
      assert.strictEqual(await sm.getSecret('key-b'), 'value-b');
    });
  });
});

suite('StorageManager - secret variables in environments', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('saveEnvironment strips secret values from JSON file', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const env: Environment = {
        id: 'env-sec',
        name: 'Secure Env',
        variables: [
          { key: 'baseUrl', value: 'http://localhost', type: 'default', enabled: true },
          { key: 'apiToken', value: 'super-secret-token', type: 'secret', enabled: true },
        ],
      };

      await sm.saveEnvironment(env);

      const filePath = path.join(sm.environmentPath, 'env-sec.json');
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const secretVar = parsed.variables.find((v: any) => v.key === 'apiToken');
      assert.ok(secretVar, 'secret variable should be present in file');
      assert.notStrictEqual(secretVar.value, 'super-secret-token', 'raw secret value should not be in file');
      assert.ok(secretVar.value.startsWith('secret-ref:'), 'secret value should be replaced with a reference');
    });
  });

  test('saveEnvironment stores secret value in SecretStorage', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const env: Environment = {
        id: 'env-sec2',
        name: 'Secure Env 2',
        variables: [
          { key: 'token', value: 'my-secret', type: 'secret', enabled: true },
        ],
      };

      await sm.saveEnvironment(env);

      // The secret should be stored in SecretStorage under a namespaced key
      const storedKeys = Object.keys(ctx._secrets);
      assert.ok(storedKeys.length > 0, 'at least one secret should be stored');
      const storedValue = Object.values(ctx._secrets as Record<string, string>)[0];
      assert.strictEqual(storedValue, 'my-secret');
    });
  });

  test('loadEnvironmentWithSecrets restores secret variable values', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const env: Environment = {
        id: 'env-restore',
        name: 'Restore Env',
        variables: [
          { key: 'baseUrl', value: 'http://localhost', type: 'default', enabled: true },
          { key: 'token', value: 'restored-secret', type: 'secret', enabled: true },
        ],
      };

      await sm.saveEnvironment(env);
      const loaded = await sm.loadEnvironmentWithSecrets('env-restore');

      assert.ok(loaded, 'environment should be loaded');
      const tokenVar = loaded!.variables.find((v) => v.key === 'token');
      assert.ok(tokenVar, 'token variable should exist');
      assert.strictEqual(tokenVar!.value, 'restored-secret', 'secret value should be restored');
    });
  });

  test('loadEnvironmentWithSecrets returns undefined for non-existent environment', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const result = await sm.loadEnvironmentWithSecrets('does-not-exist');
      assert.strictEqual(result, undefined);
    });
  });

  test('loadEnvironments does not restore secret values (returns reference)', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      const env: Environment = {
        id: 'env-noload',
        name: 'No Load Env',
        variables: [
          { key: 'token', value: 'plain-secret', type: 'secret', enabled: true },
        ],
      };

      await sm.saveEnvironment(env);
      const envs = await sm.loadEnvironments();

      assert.strictEqual(envs.length, 1);
      const tokenVar = envs[0].variables.find((v) => v.key === 'token');
      assert.ok(tokenVar, 'token variable should exist');
      assert.notStrictEqual(tokenVar!.value, 'plain-secret', 'loadEnvironments should not restore secret values');
    });
  });
});

suite('StorageManager - getStoragePaths', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('getStoragePaths returns correct workspace-specific paths', () => {
    withWorkspace(tmpDir, () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      const paths = sm.getStoragePaths();

      assert.strictEqual(paths.workspacePath, tmpDir);
      assert.strictEqual(paths.apimateRoot, path.join(tmpDir, '.vscode', 'apimate'));
      assert.strictEqual(paths.collectionPath, path.join(tmpDir, '.vscode', 'apimate', 'collections'));
      assert.strictEqual(paths.environmentPath, path.join(tmpDir, '.vscode', 'apimate', 'environments'));
    });
  });

  test('storage paths are under .vscode/apimate/ directory', () => {
    withWorkspace(tmpDir, () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);
      const paths = sm.getStoragePaths();

      assert.ok(paths.collectionPath.includes(path.join('.vscode', 'apimate')));
      assert.ok(paths.environmentPath.includes(path.join('.vscode', 'apimate')));
    });
  });
});

suite('StorageManager - deleteEnvironment', () => {
  let tmpDir: string;

  setup(() => { tmpDir = makeTempDir(); });
  teardown(() => { removeTempDir(tmpDir); });

  test('deleteEnvironment removes the environment file', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveEnvironment(makeEnvironment('del-env', 'To Delete'));
      const filePath = path.join(sm.environmentPath, 'del-env.json');
      assert.ok(fs.existsSync(filePath));

      await sm.deleteEnvironment('del-env');
      assert.ok(!fs.existsSync(filePath));
    });
  });

  test('deleteEnvironment is idempotent for non-existent environments', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await assert.doesNotReject(() => sm.deleteEnvironment('ghost-env'));
    });
  });

  test('deleted environment is not returned by loadEnvironments', async () => {
    await withWorkspace(tmpDir, async () => {
      const ctx = createMockContext(tmpDir);
      const sm = new StorageManager(ctx);

      await sm.saveEnvironment(makeEnvironment('keep-env', 'Keep'));
      await sm.saveEnvironment(makeEnvironment('remove-env', 'Remove'));
      await sm.deleteEnvironment('remove-env');

      const result = await sm.loadEnvironments();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'keep-env');
    });
  });
});
