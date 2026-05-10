import * as crypto from 'crypto';
import { HttpRequest } from './RequestManager';

// ---------------------------------------------------------------------------
// Data Models
// ---------------------------------------------------------------------------

/**
 * Variable interface for collection-level variables
 */
export interface Variable {
  key: string;
  value: string;
  type: 'default' | 'secret';
  enabled: boolean;
}

/**
 * Auth configuration (mirrors design.md AuthConfig)
 */
export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'aws-sigv4';
  config: Record<string, unknown>;
}

/**
 * Folder interface for organizing requests within a collection.
 * Supports nested folder structures (folders within folders).
 * Requirement 2.2: Collection_Manager SHALL support nested folder structures.
 */
export interface Folder {
  id: string;
  name: string;
  folders: Folder[];
  requests: HttpRequest[];
  auth?: AuthConfig;
  preRequestScript?: string;
  postRequestScript?: string;
}

/**
 * Collection interface – top-level container for folders and requests.
 * Requirement 2.1: Collection_Manager SHALL store the collection with a unique identifier and name.
 */
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

// ---------------------------------------------------------------------------
// History Data Models  (Tasks 3.2.x)
// ---------------------------------------------------------------------------

/**
 * Lightweight response summary stored in history (avoids storing full body).
 * Design doc: Request History Format.
 */
export interface HistoryResponseSummary {
  status: number;
  time: number;   // milliseconds
  size: number;   // bytes
}

/**
 * A single history entry created when a request is executed.
 * Requirement 29.1: Storage_Manager SHALL add an entry to the request history.
 */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  name?: string;
  pinned?: boolean;
  request: {
    id?: string;
    name?: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    queryParams: Record<string, string>;
  };
  response: HistoryResponseSummary;
}

/**
 * Filter options for history retrieval.
 * Requirement 29.2: Display recent requests with timestamp and status.
 */
export interface HistoryFilter {
  method?: string;
  urlContains?: string;
  status?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a UUID v4 using Node's crypto module */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Deep-clone a value using JSON serialisation.
 * Sufficient for plain-data objects (no functions / Buffers in stored requests).
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Internal search helpers
// ---------------------------------------------------------------------------

/**
 * Search for a request by id across all collections and folders.
 * Returns the container array, index, and owning collection, or null if not found.
 */
function findRequest(
  collections: Collection[],
  requestId: string,
): { container: HttpRequest[]; index: number; collection: Collection } | null {
  for (const col of collections) {
    const idx = col.requests.findIndex((r) => r.id === requestId);
    if (idx !== -1) {
      return { container: col.requests, index: idx, collection: col };
    }
    const inFolder = findRequestInFolders(col.folders, requestId, col);
    if (inFolder) {
      return inFolder;
    }
  }
  return null;
}

function findRequestInFolders(
  folders: Folder[],
  requestId: string,
  collection: Collection,
): { container: HttpRequest[]; index: number; collection: Collection } | null {
  for (const folder of folders) {
    const idx = folder.requests.findIndex((r) => r.id === requestId);
    if (idx !== -1) {
      return { container: folder.requests, index: idx, collection };
    }
    const nested = findRequestInFolders(folder.folders, requestId, collection);
    if (nested) {
      return nested;
    }
  }
  return null;
}

/**
 * Search for a folder by id across all collections.
 */
function findFolder(
  collections: Collection[],
  folderId: string,
): { container: Folder[]; index: number; collection: Collection } | null {
  for (const col of collections) {
    const result = findFolderInFolders(col.folders, folderId, col);
    if (result) {
      return result;
    }
  }
  return null;
}

function findFolderInFolders(
  folders: Folder[],
  folderId: string,
  collection: Collection,
): { container: Folder[]; index: number; collection: Collection } | null {
  for (let i = 0; i < folders.length; i++) {
    if (folders[i]!.id === folderId) {
      return { container: folders, index: i, collection };
    }
    const nested = findFolderInFolders(folders[i]!.folders, folderId, collection);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function getFolderDepth(
  folders: Folder[],
  folderId: string,
  currentDepth: number = 0,
): number {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return currentDepth;
    }
    const nested = getFolderDepth(folder.folders, folderId, currentDepth + 1);
    if (nested >= 0) {
      return nested;
    }
  }
  return -1;
}

/**
 * Resolve the effective auth for a request, walking up the folder/collection hierarchy.
 * Child auth overrides parent auth (if child has auth defined, use it; otherwise inherit).
 * Requirement 2.x / Task 3.1.7: collection-level auth and script inheritance.
 */
function resolveInheritedAuth(
  collections: Collection[],
  requestId: string,
): AuthConfig | undefined {
  for (const col of collections) {
    const result = resolveAuthInFolders(col.folders, requestId, col.auth);
    if (result !== null) {
      return result ?? undefined;
    }
    // Check top-level requests
    const req = col.requests.find((r) => r.id === requestId);
    if (req) {
      return (req.auth as AuthConfig | undefined) ?? col.auth;
    }
  }
  return undefined;
}

function resolveAuthInFolders(
  folders: Folder[],
  requestId: string,
  parentAuth: AuthConfig | undefined,
): AuthConfig | undefined | null {
  for (const folder of folders) {
    const effectiveAuth = (folder.auth as AuthConfig | undefined) ?? parentAuth;
    const req = folder.requests.find((r) => r.id === requestId);
    if (req) {
      return (req.auth as AuthConfig | undefined) ?? effectiveAuth;
    }
    const nested = resolveAuthInFolders(folder.folders, requestId, effectiveAuth);
    if (nested !== null) {
      return nested;
    }
  }
  return null; // not found in this branch
}

// ---------------------------------------------------------------------------
// CollectionManager
// ---------------------------------------------------------------------------

/**
 * CollectionManager manages request collections, folders, and organization.
 * Implements all tasks in Phase 3.1.
 */
export class CollectionManager {
  private collections: Collection[] = [];

  // -------------------------------------------------------------------------
  // 3.1.2 Collection creation and deletion
  // -------------------------------------------------------------------------

  /**
   * Create a new collection with a unique ID.
   * Requirement 2.1: Collection_Manager SHALL store the collection with a unique identifier and name.
   */
  createCollection(name: string): Collection {
    const collection: Collection = {
      id: generateId(),
      name,
      folders: [],
      requests: [],
      variables: [],
    };
    this.collections.push(collection);
    return collection;
  }

  /**
   * Delete a collection by ID.
   * Returns true if the collection was found and removed, false otherwise.
   */
  deleteCollection(collectionId: string): boolean {
    const idx = this.collections.findIndex((c) => c.id === collectionId);
    if (idx === -1) {
      return false;
    }
    this.collections.splice(idx, 1);
    return true;
  }

  // -------------------------------------------------------------------------
  // 3.1.3 Folder creation with nested structure support
  // -------------------------------------------------------------------------

  /**
   * Add a folder to a collection or to a parent folder.
   * Pass parentFolderId = null to add directly to the collection root.
   * Requirement 2.2: Collection_Manager SHALL support nested folder structures.
   */
  addFolder(collectionId: string, parentFolderId: string | null, name: string): Folder {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) {
      throw new Error(`Collection "${collectionId}" not found`);
    }

    if (parentFolderId !== null) {
      const depth = getFolderDepth(collection.folders, parentFolderId);
      if (depth >= 2) {
        throw new Error('文件夹最多支持3层嵌套 (集合 → 文件夹 → 文件夹)');
      }
    }

    const folder: Folder = {
      id: generateId(),
      name,
      folders: [],
      requests: [],
    };

    if (parentFolderId === null) {
      collection.folders.push(folder);
    } else {
      const parent = findFolder(this.collections, parentFolderId);
      if (!parent) {
        throw new Error(`Parent folder "${parentFolderId}" not found`);
      }
      (parent.container[parent.index] as Folder).folders.push(folder);
    }

    return folder;
  }

  // -------------------------------------------------------------------------
  // 3.1.4 Request addition to collections/folders
  // -------------------------------------------------------------------------

  /**
   * Add a request to a collection root or to a specific folder.
   * Pass folderId = null to add to the collection root.
   * Requirement 2.3: Collection_Manager SHALL persist the request configuration.
   */
  addRequest(collectionId: string, folderId: string | null, request: HttpRequest): void {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) {
      throw new Error(`Collection "${collectionId}" not found`);
    }

    const targetReqs = folderId === null ? collection.requests : (() => {
      const folderLoc = findFolder(this.collections, folderId);
      if (!folderLoc) {
        throw new Error(`Folder "${folderId}" not found`);
      }
      return (folderLoc.container[folderLoc.index] as Folder).requests;
    })();

    const dup = targetReqs.some(
      (r) => r.url === request.url && r.method === request.method && r.url !== ''
    );
    if (dup) {
      return;
    }

    targetReqs.push(request);
  }

  // -------------------------------------------------------------------------
  // 3.1.5 Item reordering within collections
  // -------------------------------------------------------------------------

  /**
   * Move a request to a specific index within its current container.
   * Requirement 2.4: Collection_Manager SHALL maintain the user-defined order.
   */
  reorderRequest(requestId: string, targetIndex: number): void {
    const loc = findRequest(this.collections, requestId);
    if (!loc) {
      throw new Error(`Request "${requestId}" not found`);
    }
    const { container, index } = loc;
    const requests = container as HttpRequest[];
    const [item] = requests.splice(index, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, requests.length));
    requests.splice(clampedIndex, 0, item!);
  }

  /**
   * Move a folder to a specific index within its current container.
   */
  reorderFolder(folderId: string, targetIndex: number): void {
    const loc = findFolder(this.collections, folderId);
    if (!loc) {
      throw new Error(`Folder "${folderId}" not found`);
    }
    const { container, index } = loc;
    const folders = container as Folder[];
    const [item] = folders.splice(index, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, folders.length));
    folders.splice(clampedIndex, 0, item!);
  }

  /**
   * Move an item (request or folder) to a different parent folder or collection root.
   * Requirement 2.4: Collection_Manager SHALL maintain the user-defined order.
   */
  moveItem(itemId: string, targetCollectionId: string, targetFolderId: string | null): void {
    const targetCollection = this.collections.find((c) => c.id === targetCollectionId);
    if (!targetCollection) {
      throw new Error(`Target collection "${targetCollectionId}" not found`);
    }

    // Try as request first
    const reqLoc = findRequest(this.collections, itemId);
    if (reqLoc) {
      const [request] = (reqLoc.container as HttpRequest[]).splice(reqLoc.index, 1);
      if (targetFolderId === null) {
        targetCollection.requests.push(request!);
      } else {
        const folderLoc = findFolder(this.collections, targetFolderId);
        if (!folderLoc) {
          throw new Error(`Target folder "${targetFolderId}" not found`);
        }
        (folderLoc.container[folderLoc.index] as Folder).requests.push(request!);
      }
      return;
    }

    // Try as folder
    const folderLoc = findFolder(this.collections, itemId);
    if (folderLoc) {
      const [folder] = (folderLoc.container as Folder[]).splice(folderLoc.index, 1);
      if (targetFolderId === null) {
        targetCollection.folders.push(folder!);
      } else {
        const targetFolderLoc = findFolder(this.collections, targetFolderId);
        if (!targetFolderLoc) {
          throw new Error(`Target folder "${targetFolderId}" not found`);
        }
        (targetFolderLoc.container[targetFolderLoc.index] as Folder).folders.push(folder!);
      }
      return;
    }

    throw new Error(`Item "${itemId}" not found`);
  }

  // -------------------------------------------------------------------------
  // 3.1.6 Item duplication
  // -------------------------------------------------------------------------

  /**
   * Duplicate a request (deep copy with a new ID).
   * The duplicate is placed immediately after the original in the same container.
   * Requirement 25.2: UI_Manager SHALL display options to duplicate a request.
   */
  duplicateRequest(requestId: string): HttpRequest {
    const loc = findRequest(this.collections, requestId);
    if (!loc) {
      throw new Error(`Request "${requestId}" not found`);
    }

    const original = (loc.container as HttpRequest[])[loc.index]!;
    const duplicate: HttpRequest = {
      ...deepClone(original),
      id: generateId(),
      name: `${original.name} (Copy)`,
    };

    // Insert immediately after the original
    (loc.container as HttpRequest[]).splice(loc.index + 1, 0, duplicate);
    return duplicate;
  }

  /**
   * Duplicate a folder (deep copy with new IDs for folder and all nested items).
   */
  duplicateFolder(folderId: string): Folder {
    const loc = findFolder(this.collections, folderId);
    if (!loc) {
      throw new Error(`Folder "${folderId}" not found`);
    }

    const original = (loc.container as Folder[])[loc.index]!;
    const duplicate = deepCloneFolderWithNewIds(original);
    duplicate.name = `${original.name} (Copy)`;

    (loc.container as Folder[]).splice(loc.index + 1, 0, duplicate);
    return duplicate;
  }

  // -------------------------------------------------------------------------
  // 3.1.7 Collection-level auth and script inheritance
  // -------------------------------------------------------------------------

  /**
   * Set auth configuration on a collection.
   * Child items that don't define their own auth will inherit this.
   */
  setCollectionAuth(collectionId: string, auth: AuthConfig): void {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) {
      throw new Error(`Collection "${collectionId}" not found`);
    }
    collection.auth = auth;
  }

  /**
   * Set auth configuration on a folder.
   */
  setFolderAuth(folderId: string, auth: AuthConfig): void {
    const loc = findFolder(this.collections, folderId);
    if (!loc) {
      throw new Error(`Folder "${folderId}" not found`);
    }
    (loc.container[loc.index] as Folder).auth = auth;
  }

  /**
   * Resolve the effective auth for a request, walking up the hierarchy.
   * A request's own auth takes precedence; if absent, the nearest ancestor's auth is used.
   * Task 3.1.7: collection-level auth and script inheritance.
   */
  resolveEffectiveAuth(requestId: string): AuthConfig | undefined {
    return resolveInheritedAuth(this.collections, requestId);
  }

  /**
   * Resolve the effective pre-request script for a request (inheritance chain).
   * Returns the nearest ancestor's script if the request doesn't define one.
   */
  resolveEffectivePreRequestScript(requestId: string): string | undefined {
    return resolveInheritedScript(this.collections, requestId, 'preRequestScript');
  }

  /**
   * Resolve the effective post-request script for a request (inheritance chain).
   */
  resolveEffectivePostRequestScript(requestId: string): string | undefined {
    return resolveInheritedScript(this.collections, requestId, 'postRequestScript');
  }

  // -------------------------------------------------------------------------
  // Deletion helpers
  // -------------------------------------------------------------------------

  /**
   * Delete a request by ID from wherever it lives in the tree.
   */
  deleteRequest(requestId: string): boolean {
    const loc = findRequest(this.collections, requestId);
    if (!loc) {
      return false;
    }
    (loc.container as HttpRequest[]).splice(loc.index, 1);
    return true;
  }

  /**
   * Delete a folder (and all its contents) by ID.
   */
  deleteFolder(folderId: string): boolean {
    const loc = findFolder(this.collections, folderId);
    if (!loc) {
      return false;
    }
    (loc.container as Folder[]).splice(loc.index, 1);
    return true;
  }

  renameRequest(requestId: string, newName: string): boolean {
    const loc = findRequest(this.collections, requestId);
    if (!loc) {
      return false;
    }
    const arr = loc.container as HttpRequest[];
    arr[loc.index] = { ...arr[loc.index]!, name: newName };
    return true;
  }

  renameFolder(folderId: string, newName: string): boolean {
    const loc = findFolder(this.collections, folderId);
    if (!loc) {
      return false;
    }
    const arr = loc.container as Folder[];
    arr[loc.index] = { ...arr[loc.index]!, name: newName };
    return true;
  }

  pinRequest(requestId: string): boolean {
    const loc = findRequest(this.collections, requestId);
    if (!loc) {
      return false;
    }
    const req = loc.container[loc.index] as HttpRequest;
    loc.container[loc.index] = { ...req, pinned: !req.pinned };
    return true;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Get all collections */
  getCollections(): Collection[] {
    return this.collections;
  }

  /** Get a collection by ID */
  getCollection(collectionId: string): Collection | undefined {
    return this.collections.find((c) => c.id === collectionId);
  }

  /** Replace the in-memory collections (e.g. after loading from storage) */
  setCollections(collections: Collection[]): void {
    this.collections = collections;
  }
}

// ---------------------------------------------------------------------------
// Script inheritance helper
// ---------------------------------------------------------------------------

type ScriptField = 'preRequestScript' | 'postRequestScript';

function resolveInheritedScript(
  collections: Collection[],
  requestId: string,
  field: ScriptField,
): string | undefined {
  for (const col of collections) {
    const result = resolveScriptInFolders(col.folders, requestId, col[field], field);
    if (result !== null) {
      return result;
    }
    const req = col.requests.find((r) => r.id === requestId);
    if (req) {
      return (req[field] as string | undefined) ?? col[field];
    }
  }
  return undefined;
}

function resolveScriptInFolders(
  folders: Folder[],
  requestId: string,
  parentScript: string | undefined,
  field: ScriptField,
): string | undefined | null {
  for (const folder of folders) {
    const effectiveScript = (folder[field] as string | undefined) ?? parentScript;
    const req = folder.requests.find((r) => r.id === requestId);
    if (req) {
      return (req[field] as string | undefined) ?? effectiveScript;
    }
    const nested = resolveScriptInFolders(folder.folders, requestId, effectiveScript, field);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deep clone folder with new IDs
// ---------------------------------------------------------------------------

function deepCloneFolderWithNewIds(folder: Folder): Folder {
  return {
    ...deepClone(folder),
    id: generateId(),
    requests: folder.requests.map((r) => ({ ...deepClone(r), id: generateId() })),
    folders: folder.folders.map((f) => deepCloneFolderWithNewIds(f)),
  };
}
