import * as assert from 'assert';
import {
  CollectionManager,
  AuthConfig,
} from '../../managers/CollectionManager';
import { HistoryManager } from '../../managers/HistoryManager';
import { HttpRequest, HttpResponse } from '../../managers/RequestManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    id: `req-${Math.random().toString(36).slice(2)}`,
    name: 'Test Request',
    method: 'GET',
    url: 'https://api.example.com/test',
    headers: {},
    queryParams: {},
    ...overrides,
  };
}

function makeResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '{}',
    time: 100,
    size: 2,
    cookies: [],
    ...overrides,
  };
}

function makeManager(): CollectionManager {
  return new CollectionManager();
}

// ---------------------------------------------------------------------------
// 3.1.1 / 3.1.2 – Collection creation and deletion
// ---------------------------------------------------------------------------

suite('CollectionManager - createCollection', () => {
  test('creates a collection with the given name', () => {
    const cm = makeManager();
    const col = cm.createCollection('My API');
    assert.strictEqual(col.name, 'My API');
  });

  test('assigns a unique non-empty id', () => {
    const cm = makeManager();
    const a = cm.createCollection('A');
    const b = cm.createCollection('B');
    assert.ok(a.id.length > 0);
    assert.notStrictEqual(a.id, b.id);
  });

  test('initialises with empty folders, requests, and variables', () => {
    const cm = makeManager();
    const col = cm.createCollection('Empty');
    assert.deepStrictEqual(col.folders, []);
    assert.deepStrictEqual(col.requests, []);
    assert.deepStrictEqual(col.variables, []);
  });

  test('collection is returned by getCollections()', () => {
    const cm = makeManager();
    const col = cm.createCollection('Listed');
    const all = cm.getCollections();
    assert.ok(all.some((c) => c.id === col.id));
  });

  test('multiple collections are stored independently', () => {
    const cm = makeManager();
    cm.createCollection('Alpha');
    cm.createCollection('Beta');
    assert.strictEqual(cm.getCollections().length, 2);
  });
});

suite('CollectionManager - deleteCollection', () => {
  test('removes the collection from the list', () => {
    const cm = makeManager();
    const col = cm.createCollection('ToDelete');
    cm.deleteCollection(col.id);
    assert.strictEqual(cm.getCollections().length, 0);
  });

  test('returns true when collection exists', () => {
    const cm = makeManager();
    const col = cm.createCollection('X');
    assert.strictEqual(cm.deleteCollection(col.id), true);
  });

  test('returns false for non-existent collection', () => {
    const cm = makeManager();
    assert.strictEqual(cm.deleteCollection('ghost'), false);
  });

  test('does not affect other collections', () => {
    const cm = makeManager();
    const a = cm.createCollection('A');
    const b = cm.createCollection('B');
    cm.deleteCollection(a.id);
    const remaining = cm.getCollections();
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0]!.id, b.id);
  });
});

// ---------------------------------------------------------------------------
// 3.1.3 – Folder creation with nested structure support
// ---------------------------------------------------------------------------

suite('CollectionManager - addFolder (root level)', () => {
  test('adds a folder to the collection root', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'Users');
    assert.strictEqual(col.folders.length, 1);
    assert.strictEqual(folder.name, 'Users');
  });

  test('folder has a unique non-empty id', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const f1 = cm.addFolder(col.id, null, 'F1');
    const f2 = cm.addFolder(col.id, null, 'F2');
    assert.ok(f1.id.length > 0);
    assert.notStrictEqual(f1.id, f2.id);
  });

  test('folder initialises with empty sub-folders and requests', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'Empty');
    assert.deepStrictEqual(folder.folders, []);
    assert.deepStrictEqual(folder.requests, []);
  });

  test('throws for unknown collection id', () => {
    const cm = makeManager();
    assert.throws(() => cm.addFolder('no-such-col', null, 'F'), /not found/i);
  });
});

suite('CollectionManager - addFolder (nested)', () => {
  test('adds a sub-folder inside an existing folder', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const parent = cm.addFolder(col.id, null, 'Parent');
    const child = cm.addFolder(col.id, parent.id, 'Child');
    assert.strictEqual(parent.folders.length, 1);
    assert.strictEqual(parent.folders[0]!.id, child.id);
  });

  test('supports deeply nested folders', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const l1 = cm.addFolder(col.id, null, 'L1');
    const l2 = cm.addFolder(col.id, l1.id, 'L2');
    const l3 = cm.addFolder(col.id, l2.id, 'L3');
    assert.strictEqual(l2.folders[0]!.id, l3.id);
  });

  test('throws for unknown parent folder id', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    assert.throws(() => cm.addFolder(col.id, 'ghost-folder', 'F'), /not found/i);
  });
});

// ---------------------------------------------------------------------------
// 3.1.4 – Request addition to collections/folders
// ---------------------------------------------------------------------------

suite('CollectionManager - addRequest', () => {
  test('adds a request to the collection root', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, null, req);
    assert.strictEqual(col.requests.length, 1);
    assert.strictEqual(col.requests[0]!.id, 'r1');
  });

  test('adds a request to a specific folder', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'F');
    const req = makeRequest({ id: 'r2' });
    cm.addRequest(col.id, folder.id, req);
    assert.strictEqual(folder.requests.length, 1);
    assert.strictEqual(folder.requests[0]!.id, 'r2');
    assert.strictEqual(col.requests.length, 0);
  });

  test('adds a request to a nested folder', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const parent = cm.addFolder(col.id, null, 'Parent');
    const child = cm.addFolder(col.id, parent.id, 'Child');
    const req = makeRequest({ id: 'r3' });
    cm.addRequest(col.id, child.id, req);
    assert.strictEqual(child.requests.length, 1);
  });

  test('throws for unknown collection id', () => {
    const cm = makeManager();
    assert.throws(() => cm.addRequest('no-col', null, makeRequest()), /not found/i);
  });

  test('throws for unknown folder id', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    assert.throws(() => cm.addRequest(col.id, 'ghost-folder', makeRequest()), /not found/i);
  });
});

// ---------------------------------------------------------------------------
// 3.1.5 – Item reordering
// ---------------------------------------------------------------------------

suite('CollectionManager - reorderRequest', () => {
  test('moves a request to a lower index', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const r1 = makeRequest({ id: 'r1', name: 'First' });
    const r2 = makeRequest({ id: 'r2', name: 'Second' });
    const r3 = makeRequest({ id: 'r3', name: 'Third' });
    cm.addRequest(col.id, null, r1);
    cm.addRequest(col.id, null, r2);
    cm.addRequest(col.id, null, r3);

    cm.reorderRequest('r3', 0);
    assert.strictEqual(col.requests[0]!.id, 'r3');
    assert.strictEqual(col.requests[1]!.id, 'r1');
    assert.strictEqual(col.requests[2]!.id, 'r2');
  });

  test('moves a request to a higher index', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const r1 = makeRequest({ id: 'r1' });
    const r2 = makeRequest({ id: 'r2' });
    cm.addRequest(col.id, null, r1);
    cm.addRequest(col.id, null, r2);

    cm.reorderRequest('r1', 1);
    assert.strictEqual(col.requests[0]!.id, 'r2');
    assert.strictEqual(col.requests[1]!.id, 'r1');
  });

  test('clamps target index to valid range', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const r1 = makeRequest({ id: 'r1' });
    const r2 = makeRequest({ id: 'r2' });
    cm.addRequest(col.id, null, r1);
    cm.addRequest(col.id, null, r2);

    cm.reorderRequest('r1', 999);
    assert.strictEqual(col.requests[col.requests.length - 1]!.id, 'r1');
  });

  test('throws for unknown request id', () => {
    const cm = makeManager();
    assert.throws(() => cm.reorderRequest('ghost', 0), /not found/i);
  });
});

suite('CollectionManager - reorderFolder', () => {
  test('moves a folder to a different index', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const f1 = cm.addFolder(col.id, null, 'F1');
    const f2 = cm.addFolder(col.id, null, 'F2');
    const f3 = cm.addFolder(col.id, null, 'F3');

    cm.reorderFolder(f3.id, 0);
    assert.strictEqual(col.folders[0]!.id, f3.id);
    assert.strictEqual(col.folders[1]!.id, f1.id);
    assert.strictEqual(col.folders[2]!.id, f2.id);
  });

  test('throws for unknown folder id', () => {
    const cm = makeManager();
    assert.throws(() => cm.reorderFolder('ghost', 0), /not found/i);
  });
});

// ---------------------------------------------------------------------------
// 3.1.6 – Item duplication
// ---------------------------------------------------------------------------

suite('CollectionManager - duplicateRequest', () => {
  test('creates a copy with a new id', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const req = makeRequest({ id: 'orig', name: 'Original' });
    cm.addRequest(col.id, null, req);

    const dup = cm.duplicateRequest('orig');
    assert.notStrictEqual(dup.id, 'orig');
    assert.ok(dup.id.length > 0);
  });

  test('copy name has "(Copy)" suffix', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const req = makeRequest({ id: 'orig', name: 'Get Users' });
    cm.addRequest(col.id, null, req);

    const dup = cm.duplicateRequest('orig');
    assert.strictEqual(dup.name, 'Get Users (Copy)');
  });

  test('duplicate is placed immediately after the original', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const r1 = makeRequest({ id: 'r1', name: 'R1' });
    const r2 = makeRequest({ id: 'r2', name: 'R2' });
    cm.addRequest(col.id, null, r1);
    cm.addRequest(col.id, null, r2);

    cm.duplicateRequest('r1');
    assert.strictEqual(col.requests[0]!.id, 'r1');
    assert.strictEqual(col.requests[1]!.name, 'R1 (Copy)');
    assert.strictEqual(col.requests[2]!.id, 'r2');
  });

  test('duplicate is a deep copy (modifying original does not affect copy)', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const req = makeRequest({ id: 'orig', headers: { 'X-Token': 'abc' } });
    cm.addRequest(col.id, null, req);

    const dup = cm.duplicateRequest('orig');
    col.requests[0]!.headers['X-Token'] = 'changed';
    assert.strictEqual(dup.headers['X-Token'], 'abc');
  });

  test('throws for unknown request id', () => {
    const cm = makeManager();
    assert.throws(() => cm.duplicateRequest('ghost'), /not found/i);
  });
});

// ---------------------------------------------------------------------------
// 3.1.7 – Collection-level auth and script inheritance
// ---------------------------------------------------------------------------

suite('CollectionManager - auth inheritance', () => {
  const bearerAuth: AuthConfig = { type: 'bearer', config: { token: 'tok' } };
  const basicAuth: AuthConfig = { type: 'basic', config: { username: 'u', password: 'p' } };

  test('request inherits collection auth when it has none', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    cm.setCollectionAuth(col.id, bearerAuth);
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, null, req);

    const effective = cm.resolveEffectiveAuth('r1');
    assert.deepStrictEqual(effective, bearerAuth);
  });

  test('request own auth overrides collection auth', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    cm.setCollectionAuth(col.id, bearerAuth);
    const req = makeRequest({ id: 'r1', auth: basicAuth });
    cm.addRequest(col.id, null, req);

    const effective = cm.resolveEffectiveAuth('r1');
    assert.deepStrictEqual(effective, basicAuth);
  });

  test('request in folder inherits folder auth', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'F');
    cm.setFolderAuth(folder.id, bearerAuth);
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, folder.id, req);

    const effective = cm.resolveEffectiveAuth('r1');
    assert.deepStrictEqual(effective, bearerAuth);
  });

  test('folder auth overrides collection auth', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    cm.setCollectionAuth(col.id, bearerAuth);
    const folder = cm.addFolder(col.id, null, 'F');
    cm.setFolderAuth(folder.id, basicAuth);
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, folder.id, req);

    const effective = cm.resolveEffectiveAuth('r1');
    assert.deepStrictEqual(effective, basicAuth);
  });

  test('returns undefined for unknown request id', () => {
    const cm = makeManager();
    const effective = cm.resolveEffectiveAuth('ghost');
    assert.strictEqual(effective, undefined);
  });
});

suite('CollectionManager - script inheritance', () => {
  test('request inherits collection pre-request script', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    col.preRequestScript = 'console.log("pre")';
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, null, req);

    const script = cm.resolveEffectivePreRequestScript('r1');
    assert.strictEqual(script, 'console.log("pre")');
  });

  test('request own script overrides collection script', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    col.preRequestScript = 'collection-script';
    const req = makeRequest({ id: 'r1', preRequestScript: 'request-script' });
    cm.addRequest(col.id, null, req);

    const script = cm.resolveEffectivePreRequestScript('r1');
    assert.strictEqual(script, 'request-script');
  });

  test('returns undefined for unknown request id', () => {
    const cm = makeManager();
    const script = cm.resolveEffectivePreRequestScript('ghost');
    assert.strictEqual(script, undefined);
  });
});

// ---------------------------------------------------------------------------
// deleteRequest / deleteFolder helpers
// ---------------------------------------------------------------------------

suite('CollectionManager - deleteRequest', () => {
  test('removes a request from the collection root', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, null, req);
    cm.deleteRequest('r1');
    assert.strictEqual(col.requests.length, 0);
  });

  test('removes a request from a folder', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'F');
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, folder.id, req);
    cm.deleteRequest('r1');
    assert.strictEqual(folder.requests.length, 0);
  });

  test('returns false for unknown request id', () => {
    const cm = makeManager();
    assert.strictEqual(cm.deleteRequest('ghost'), false);
  });
});

suite('CollectionManager - deleteFolder', () => {
  test('removes a folder from the collection', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'F');
    cm.deleteFolder(folder.id);
    assert.strictEqual(col.folders.length, 0);
  });

  test('returns false for unknown folder id', () => {
    const cm = makeManager();
    assert.strictEqual(cm.deleteFolder('ghost'), false);
  });
});

// ---------------------------------------------------------------------------
// moveItem
// ---------------------------------------------------------------------------

suite('CollectionManager - moveItem', () => {
  test('moves a request from collection root to a folder', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'F');
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, null, req);

    cm.moveItem('r1', col.id, folder.id);
    assert.strictEqual(col.requests.length, 0);
    assert.strictEqual(folder.requests.length, 1);
  });

  test('moves a request from a folder to collection root', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    const folder = cm.addFolder(col.id, null, 'F');
    const req = makeRequest({ id: 'r1' });
    cm.addRequest(col.id, folder.id, req);

    cm.moveItem('r1', col.id, null);
    assert.strictEqual(folder.requests.length, 0);
    assert.strictEqual(col.requests.length, 1);
  });

  test('throws for unknown item id', () => {
    const cm = makeManager();
    const col = cm.createCollection('C');
    assert.throws(() => cm.moveItem('ghost', col.id, null), /not found/i);
  });
});

// ---------------------------------------------------------------------------
// 3.2.1 / 3.2.2 – HistoryManager: data model and entry creation
// ---------------------------------------------------------------------------

suite('HistoryManager - addEntry', () => {
  test('creates an entry with a unique id', () => {
    const hm = new HistoryManager();
    const req = makeRequest({ id: 'r1' });
    const res = makeResponse();
    const entry = hm.addEntry(req, res);
    assert.ok(entry.id.length > 0);
  });

  test('entry contains request method and url', () => {
    const hm = new HistoryManager();
    const req = makeRequest({ method: 'POST', url: 'https://api.example.com/users' });
    const res = makeResponse();
    const entry = hm.addEntry(req, res);
    assert.strictEqual(entry.request.method, 'POST');
    assert.strictEqual(entry.request.url, 'https://api.example.com/users');
  });

  test('entry contains response summary (status, time, size)', () => {
    const hm = new HistoryManager();
    const req = makeRequest();
    const res = makeResponse({ status: 201, time: 250, size: 512 });
    const entry = hm.addEntry(req, res);
    assert.strictEqual(entry.response.status, 201);
    assert.strictEqual(entry.response.time, 250);
    assert.strictEqual(entry.response.size, 512);
  });

  test('entry has a timestamp close to now', () => {
    const before = Date.now();
    const hm = new HistoryManager();
    const entry = hm.addEntry(makeRequest(), makeResponse());
    const after = Date.now();
    assert.ok(entry.timestamp >= before && entry.timestamp <= after);
  });

  test('newest entry is first in the list', () => {
    const hm = new HistoryManager();
    const e1 = hm.addEntry(makeRequest({ url: 'https://first.com' }), makeResponse());
    const e2 = hm.addEntry(makeRequest({ url: 'https://second.com' }), makeResponse());
    const entries = hm.getEntries();
    assert.strictEqual(entries[0]!.id, e2.id);
    assert.strictEqual(entries[1]!.id, e1.id);
  });

  test('increments count', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest(), makeResponse());
    hm.addEntry(makeRequest(), makeResponse());
    assert.strictEqual(hm.getCount(), 2);
  });
});

// ---------------------------------------------------------------------------
// 3.2.3 – History retrieval with filtering
// ---------------------------------------------------------------------------

suite('HistoryManager - getEntries (no filter)', () => {
  test('returns all entries when no filter provided', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest(), makeResponse());
    hm.addEntry(makeRequest(), makeResponse());
    assert.strictEqual(hm.getEntries().length, 2);
  });

  test('returns empty array when no entries', () => {
    const hm = new HistoryManager();
    assert.deepStrictEqual(hm.getEntries(), []);
  });
});

suite('HistoryManager - getEntries (with filter)', () => {
  test('filters by HTTP method', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest({ method: 'GET' }), makeResponse());
    hm.addEntry(makeRequest({ method: 'POST' }), makeResponse());
    const gets = hm.getEntries({ method: 'GET' });
    assert.strictEqual(gets.length, 1);
    assert.strictEqual(gets[0]!.request.method, 'GET');
  });

  test('method filter is case-insensitive', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest({ method: 'GET' }), makeResponse());
    const result = hm.getEntries({ method: 'get' });
    assert.strictEqual(result.length, 1);
  });

  test('filters by URL substring', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest({ url: 'https://api.example.com/users' }), makeResponse());
    hm.addEntry(makeRequest({ url: 'https://api.example.com/orders' }), makeResponse());
    const result = hm.getEntries({ urlContains: 'users' });
    assert.strictEqual(result.length, 1);
    assert.ok(result[0]!.request.url.includes('users'));
  });

  test('filters by response status', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest(), makeResponse({ status: 200 }));
    hm.addEntry(makeRequest(), makeResponse({ status: 404 }));
    const result = hm.getEntries({ status: 404 });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]!.response.status, 404);
  });

  test('combines multiple filter criteria (AND)', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest({ method: 'GET', url: 'https://api.example.com/users' }), makeResponse({ status: 200 }));
    hm.addEntry(makeRequest({ method: 'POST', url: 'https://api.example.com/users' }), makeResponse({ status: 201 }));
    const result = hm.getEntries({ method: 'GET', status: 200 });
    assert.strictEqual(result.length, 1);
  });

  test('returns empty array when no entries match filter', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest({ method: 'GET' }), makeResponse());
    const result = hm.getEntries({ method: 'DELETE' });
    assert.deepStrictEqual(result, []);
  });
});

suite('HistoryManager - getEntry', () => {
  test('retrieves a specific entry by id', () => {
    const hm = new HistoryManager();
    const entry = hm.addEntry(makeRequest(), makeResponse());
    const found = hm.getEntry(entry.id);
    assert.ok(found);
    assert.strictEqual(found!.id, entry.id);
  });

  test('returns undefined for unknown id', () => {
    const hm = new HistoryManager();
    assert.strictEqual(hm.getEntry('ghost'), undefined);
  });
});

// ---------------------------------------------------------------------------
// 3.2.4 – History entry deletion
// ---------------------------------------------------------------------------

suite('HistoryManager - deleteEntry', () => {
  test('removes the entry from history', () => {
    const hm = new HistoryManager();
    const entry = hm.addEntry(makeRequest(), makeResponse());
    hm.deleteEntry(entry.id);
    assert.strictEqual(hm.getCount(), 0);
  });

  test('returns true when entry exists', () => {
    const hm = new HistoryManager();
    const entry = hm.addEntry(makeRequest(), makeResponse());
    assert.strictEqual(hm.deleteEntry(entry.id), true);
  });

  test('returns false for unknown entry id', () => {
    const hm = new HistoryManager();
    assert.strictEqual(hm.deleteEntry('ghost'), false);
  });

  test('does not affect other entries', () => {
    const hm = new HistoryManager();
    const e1 = hm.addEntry(makeRequest(), makeResponse());
    const e2 = hm.addEntry(makeRequest(), makeResponse());
    hm.deleteEntry(e1.id);
    assert.strictEqual(hm.getCount(), 1);
    assert.ok(hm.getEntry(e2.id));
  });
});

suite('HistoryManager - clearAll', () => {
  test('removes all entries', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest(), makeResponse());
    hm.addEntry(makeRequest(), makeResponse());
    hm.clearAll();
    assert.strictEqual(hm.getCount(), 0);
  });

  test('clearAll on empty history does not throw', () => {
    const hm = new HistoryManager();
    assert.doesNotThrow(() => hm.clearAll());
  });
});

// ---------------------------------------------------------------------------
// 3.2.5 – History size limit and automatic cleanup
// ---------------------------------------------------------------------------

suite('HistoryManager - size limit', () => {
  test('default limit is 100', () => {
    const hm = new HistoryManager();
    assert.strictEqual(hm.getLimit(), 100);
  });

  test('custom limit is respected', () => {
    const hm = new HistoryManager(10);
    assert.strictEqual(hm.getLimit(), 10);
  });

  test('oldest entries are removed when limit is exceeded', () => {
    const hm = new HistoryManager(3);
    const e1 = hm.addEntry(makeRequest({ url: 'https://first.com' }), makeResponse());
    hm.addEntry(makeRequest({ url: 'https://second.com' }), makeResponse());
    hm.addEntry(makeRequest({ url: 'https://third.com' }), makeResponse());
    // Adding a 4th entry should evict the oldest (e1)
    hm.addEntry(makeRequest({ url: 'https://fourth.com' }), makeResponse());

    assert.strictEqual(hm.getCount(), 3);
    assert.strictEqual(hm.getEntry(e1.id), undefined);
  });

  test('count never exceeds the limit', () => {
    const hm = new HistoryManager(5);
    for (let i = 0; i < 20; i++) {
      hm.addEntry(makeRequest(), makeResponse());
    }
    assert.ok(hm.getCount() <= 5);
  });

  test('setLimit trims existing entries if over new limit', () => {
    const hm = new HistoryManager(10);
    for (let i = 0; i < 10; i++) {
      hm.addEntry(makeRequest(), makeResponse());
    }
    hm.setLimit(3);
    assert.strictEqual(hm.getCount(), 3);
  });

  test('throws when limit is less than 1', () => {
    assert.throws(() => new HistoryManager(0), /limit/i);
    assert.throws(() => new HistoryManager(-1), /limit/i);
  });
});

// ---------------------------------------------------------------------------
// HistoryManager – serialisation (toJSON / fromJSON)
// ---------------------------------------------------------------------------

suite('HistoryManager - serialisation', () => {
  test('toJSON returns all entries', () => {
    const hm = new HistoryManager();
    hm.addEntry(makeRequest(), makeResponse());
    const data = hm.toJSON();
    assert.strictEqual(data.history.length, 1);
  });

  test('fromJSON restores entries', () => {
    const hm = new HistoryManager();
    const entry = hm.addEntry(makeRequest(), makeResponse());
    const data = hm.toJSON();

    const hm2 = new HistoryManager();
    hm2.fromJSON(data);
    assert.strictEqual(hm2.getCount(), 1);
    assert.ok(hm2.getEntry(entry.id));
  });

  test('fromJSON enforces current limit', () => {
    const hm = new HistoryManager(100);
    for (let i = 0; i < 10; i++) {
      hm.addEntry(makeRequest(), makeResponse());
    }
    const data = hm.toJSON();

    const hm2 = new HistoryManager(3);
    hm2.fromJSON(data);
    assert.strictEqual(hm2.getCount(), 3);
  });
});
