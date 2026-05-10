import * as crypto from 'crypto';
import { HttpRequest, HttpResponse } from './RequestManager';
import { HistoryEntry, HistoryFilter, HistoryResponseSummary } from './CollectionManager';

// Re-export for convenience
export type { HistoryEntry, HistoryFilter, HistoryResponseSummary };

/** Default maximum number of history entries to retain */
const DEFAULT_HISTORY_LIMIT = 100;

/**
 * HistoryManager stores and manages request execution history.
 *
 * Tasks 3.2.1 – 3.2.5:
 *  - 3.2.1 History data model and storage
 *  - 3.2.2 History entry creation on request execution
 *  - 3.2.3 History retrieval with filtering
 *  - 3.2.4 History entry deletion
 *  - 3.2.5 History size limit and automatic cleanup
 *
 * Requirement 29: Request History
 */
export class HistoryManager {
  private entries: HistoryEntry[] = [];
  private limit: number;

  constructor(limit: number = DEFAULT_HISTORY_LIMIT) {
    if (limit < 1) {
      throw new Error('History limit must be at least 1');
    }
    this.limit = limit;
  }

  // -------------------------------------------------------------------------
  // 3.2.2 History entry creation on request execution
  // -------------------------------------------------------------------------

  /**
   * Record a completed request/response pair in history.
   * Automatically trims oldest entries when the limit is exceeded.
   * Requirement 29.1: Storage_Manager SHALL add an entry to the request history.
   * Requirement 29.5: When history exceeds a limit, remove the oldest entries.
   */
  addEntry(request: HttpRequest, response: HttpResponse): HistoryEntry {
    const responseSummary: HistoryResponseSummary = {
      status: response.status,
      time: response.time,
      size: response.size,
    };

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      request: {
        id: request.id,
        name: request.name,
        method: request.method,
        url: request.url,
        headers: { ...request.headers },
        queryParams: { ...request.queryParams },
      },
      response: responseSummary,
    };

    const firstUnpinned = this.entries.findIndex((e) => !e.pinned);
    if (firstUnpinned === -1) {
      this.entries.push(entry);
    } else {
      this.entries.splice(firstUnpinned, 0, entry);
    }

    this.deduplicate();
    this.trim();

    return entry;
  }

  addCopiedEntry(request: HttpRequest): HistoryEntry {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      request: {
        id: request.id,
        name: request.name,
        method: request.method,
        url: request.url,
        headers: { ...request.headers },
        queryParams: { ...request.queryParams },
      },
      name: request.name,
      response: { status: 0, time: 0, size: 0 },
    };

    const firstUnpinned = this.entries.findIndex((e) => !e.pinned);
    if (firstUnpinned === -1) {
      this.entries.push(entry);
    } else {
      this.entries.splice(firstUnpinned, 0, entry);
    }

    this.trim();
    return entry;
  }

  updateEntryResponse(entryId: string, response: HistoryResponseSummary): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) { return false; }
    entry.response = response;
    return true;
  }

  // -------------------------------------------------------------------------
  // 3.2.3 History retrieval with filtering
  // -------------------------------------------------------------------------

  /**
   * Retrieve history entries, optionally filtered by method, URL substring, or status.
   * Requirement 29.2: Display recent requests with timestamp and status.
   */
  getEntries(filter?: HistoryFilter): HistoryEntry[] {
    if (!filter) {
      return [...this.entries];
    }

    return this.entries.filter((entry) => {
      if (filter.method !== undefined) {
        if (entry.request.method.toUpperCase() !== filter.method.toUpperCase()) {
          return false;
        }
      }
      if (filter.urlContains !== undefined) {
        if (!entry.request.url.includes(filter.urlContains)) {
          return false;
        }
      }
      if (filter.status !== undefined) {
        if (entry.response.status !== filter.status) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Retrieve a single history entry by ID.
   * Requirement 29.3: When a user selects a history entry, load the request configuration.
   */
  getEntry(entryId: string): HistoryEntry | undefined {
    return this.entries.find((e) => e.id === entryId);
  }

  // -------------------------------------------------------------------------
  // 3.2.4 History entry deletion
  // -------------------------------------------------------------------------

  /**
   * Delete a single history entry by ID.
   * Returns true if the entry was found and removed.
   */
  deleteEntry(entryId: string): boolean {
    const idx = this.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      return false;
    }
    this.entries.splice(idx, 1);
    return true;
  }

  renameEntry(entryId: string, name: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) { return false; }
    entry.name = name;
    return true;
  }

  pinEntry(entryId: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) { return false; }
    entry.pinned = !entry.pinned;
    if (entry.pinned) {
      const idx = this.entries.findIndex((e) => e.id === entryId);
      this.entries.splice(idx, 1);
      const firstUnpinned = this.entries.findIndex((e) => !e.pinned);
      if (firstUnpinned === -1) { this.entries.push(entry); }
      else { this.entries.splice(firstUnpinned, 0, entry); }
    } else {
      this.entries.sort((a, b) => (a.pinned === b.pinned ? b.timestamp - a.timestamp : a.pinned ? -1 : 1));
    }
    return true;
  }

  /**
   * Clear all history entries.
   * Requirement 29.4: When a user clears history, remove all history entries.
   */
  clearAll(): void {
    this.entries = [];
  }

  // -------------------------------------------------------------------------
  // 3.2.5 History size limit and automatic cleanup
  // -------------------------------------------------------------------------

  /**
   * Get the current history size limit.
   */
  getLimit(): number {
    return this.limit;
  }

  /**
   * Update the history size limit and immediately trim if necessary.
   */
  setLimit(limit: number): void {
    if (limit < 1) {
      throw new Error('History limit must be at least 1');
    }
    this.limit = limit;
    this.trim();
  }

  /**
   * Get the current number of history entries.
   */
  getCount(): number {
    return this.entries.length;
  }

  /**
   * Serialise history to a plain object for persistence (e.g. workspace state).
   */
  toJSON(): { history: HistoryEntry[] } {
    return { history: [...this.entries] };
  }

  /**
   * Restore history from a previously serialised object.
   * Enforces the current limit after loading.
   */
  fromJSON(data: { history: HistoryEntry[] }): void {
    this.entries = Array.isArray(data.history) ? [...data.history] : [];
    this.trim();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Remove oldest entries (from the tail) until within the limit */
  private trim(): void {
    if (this.entries.length > this.limit) {
      this.entries.splice(this.limit);
    }
  }

  /** Remove duplicate entries with same method+url+name, keeping the newest */
  private deduplicate(): void {
    const seen = new Set<string>();
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i]!;
      const key = `${e.request.method}|${e.request.url}|${e.name || ''}`;
      if (seen.has(key)) {
        if (!e.pinned) {
          this.entries.splice(i, 1);
        }
      } else {
        seen.add(key);
      }
    }
  }
}
