import * as fs from 'fs';
import { HttpRequest, HttpResponse, executeHttpRequest } from './RequestManager';
import { CollectionManager, Collection, Folder } from './CollectionManager';
import { ScriptEngine, TestResult, ScriptContext } from './ScriptEngine';
import { EnvironmentManager } from './EnvironmentManager';

// ---------------------------------------------------------------------------
// Interfaces  (Task 6.3.1)
// ---------------------------------------------------------------------------

/**
 * Configuration for a collection run.
 * Requirement 10: Test_Runner SHALL execute all requests in the collection.
 */
export interface CollectionRunConfig {
  /** ID of the collection to run */
  collectionId: string;
  /** Optional environment manager to use for variable resolution */
  environment?: EnvironmentManager;
  /** Iteration data (already parsed array of objects) */
  iterationData?: Record<string, unknown>[];
  /** Run requests in parallel */
  parallel: boolean;
  /** Maximum concurrent requests when parallel=true */
  maxParallel?: number;
  /** Stop the run when a request or test fails */
  stopOnFailure: boolean;
  /** Delay in milliseconds between requests */
  delay?: number;
}

/**
 * Result of a single request execution within a collection run.
 */
export interface RequestResult {
  request: HttpRequest;
  response?: HttpResponse;
  tests: TestResult[];
  error?: string;
  /** Total time including script execution (ms) */
  totalTime: number;
}

/**
 * Result of a single iteration (one pass through all requests).
 */
export interface IterationResult {
  iterationNumber: number;
  requests: RequestResult[];
}

/**
 * Aggregated result of a complete collection run.
 * Requirement 10.3: Test_Runner SHALL display a summary of passed and failed tests.
 */
export interface CollectionRunResult {
  totalRequests: number;
  passedTests: number;
  failedTests: number;
  /** Total wall-clock time for the entire run (ms) */
  totalTime: number;
  iterations: IterationResult[];
}

// ---------------------------------------------------------------------------
// CSV / JSON iteration data parsing  (Tasks 6.3.4, 6.3.5)
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into an array of row objects.
 * The first row is treated as the header.
 * Requirement 11.1: Test_Runner SHALL parse the CSV and use each row as iteration data.
 */
export function parseCsvIterationData(csv: string): Record<string, unknown>[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]!);
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]!);
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

/** Split a single CSV line respecting quoted fields */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse a JSON string into an array of iteration data objects.
 * Requirement 11.2: Test_Runner SHALL parse the JSON array and use each element as iteration data.
 */
export function parseJsonIterationData(json: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON iteration data must be an array');
  }
  return parsed as Record<string, unknown>[];
}

/**
 * Load iteration data from a file path (CSV or JSON based on extension).
 */
export function loadIterationDataFromFile(filePath: string): Record<string, unknown>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (filePath.toLowerCase().endsWith('.csv')) {
    return parseCsvIterationData(content);
  }
  return parseJsonIterationData(content);
}

// ---------------------------------------------------------------------------
// TestRunner  (Tasks 6.3.2 – 6.3.8)
// ---------------------------------------------------------------------------

/**
 * TestRunner executes collection runs with sequential or parallel execution,
 * iteration data support, stop-on-failure, and delay options.
 *
 * Requirements 10 & 11.
 */
export class TestRunner {
  constructor(private scriptEngine: ScriptEngine) {}

  /**
   * Run a collection and return aggregated results.
   * Requirement 10.1: Test_Runner SHALL execute all requests in the collection sequentially.
   * Requirement 10.2: Test_Runner SHALL execute requests concurrently up to a specified limit.
   */
  async runCollection(
    config: CollectionRunConfig,
    collectionManager: CollectionManager
  ): Promise<CollectionRunResult> {
    const collection = collectionManager.getCollection(config.collectionId);
    if (!collection) {
      throw new Error(`Collection "${config.collectionId}" not found`);
    }

    // Flatten all requests from the collection (top-level + folders)
    const requests = flattenRequests(collection);

    // Determine iterations
    const iterationDataSets: (Record<string, unknown> | undefined)[] =
      config.iterationData && config.iterationData.length > 0
        ? config.iterationData
        : [undefined];

    const runStart = Date.now();
    const iterationResults: IterationResult[] = [];
    let totalPassedTests = 0;
    let totalFailedTests = 0;
    let totalRequests = 0;
    let stopped = false;

    for (let iterIdx = 0; iterIdx < iterationDataSets.length; iterIdx++) {
      if (stopped) {
        break;
      }

      const iterData = iterationDataSets[iterIdx];
      let requestResults: RequestResult[];

      if (config.parallel) {
        requestResults = await this._executeRequestsInParallel(
          requests,
          config,
          iterData,
          config.maxParallel ?? 5
        );
      } else {
        requestResults = await this._executeRequestsSequentially(
          requests,
          config,
          iterData,
          () => stopped
        );
      }

      // Aggregate
      for (const rr of requestResults) {
        totalRequests++;
        for (const t of rr.tests) {
          if (t.passed) {
            totalPassedTests++;
          } else {
            totalFailedTests++;
            if (config.stopOnFailure) {
              stopped = true;
            }
          }
        }
        if (rr.error && config.stopOnFailure) {
          stopped = true;
        }
      }

      iterationResults.push({
        iterationNumber: iterIdx + 1,
        requests: requestResults,
      });
    }

    return {
      totalRequests,
      passedTests: totalPassedTests,
      failedTests: totalFailedTests,
      totalTime: Date.now() - runStart,
      iterations: iterationResults,
    };
  }

  // -------------------------------------------------------------------------
  // Sequential execution  (Task 6.3.2)
  // -------------------------------------------------------------------------

  private async _executeRequestsSequentially(
    requests: HttpRequest[],
    config: CollectionRunConfig,
    iterData: Record<string, unknown> | undefined,
    isStopped: () => boolean
  ): Promise<RequestResult[]> {
    const results: RequestResult[] = [];

    for (const request of requests) {
      if (isStopped()) {
        break;
      }

      const result = await this._executeRequest(request, config, iterData);
      results.push(result);

      // Stop-on-failure check  (Task 6.3.7)
      const hasFailed =
        result.error !== undefined || result.tests.some((t) => !t.passed);
      if (hasFailed && config.stopOnFailure) {
        break;
      }

      // Delay between requests  (Task 6.3.8)
      if (config.delay && config.delay > 0) {
        await sleep(config.delay);
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Parallel execution  (Task 6.3.3)
  // -------------------------------------------------------------------------

  private async _executeRequestsInParallel(
    requests: HttpRequest[],
    config: CollectionRunConfig,
    iterData: Record<string, unknown> | undefined,
    maxParallel: number
  ): Promise<RequestResult[]> {
    const results: RequestResult[] = Array.from<RequestResult>({ length: requests.length });
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < requests.length) {
        const currentIndex = index++;
        const request = requests[currentIndex]!;
        results[currentIndex] = await this._executeRequest(request, config, iterData);
      }
    };

    const workers = Array.from({ length: Math.min(maxParallel, requests.length) }, () =>
      worker()
    );
    await Promise.all(workers);

    return results;
  }

  // -------------------------------------------------------------------------
  // Single request execution
  // -------------------------------------------------------------------------

  private async _executeRequest(
    request: HttpRequest,
    config: CollectionRunConfig,
    iterData: Record<string, unknown> | undefined
  ): Promise<RequestResult> {
    const start = Date.now();
    const localVars = new Map<string, string>();

    // Inject iteration data into local variables  (Requirement 11.3)
    if (iterData) {
      for (const [k, v] of Object.entries(iterData)) {
        localVars.set(k, String(v));
      }
    }

    const environment = config.environment ?? new EnvironmentManager();

    const scriptContext: ScriptContext = {
      request,
      environment,
      localVariables: localVars,
    };

    let response: HttpResponse | undefined;
    let error: string | undefined;
    let tests: TestResult[] = [];

    try {
      // Pre-request script
      if (request.preRequestScript) {
        await this.scriptEngine.executePreRequestScript(request.preRequestScript, scriptContext);
      }

      // Execute the HTTP request
      response = await executeHttpRequest(request);

      // Post-request script / tests
      const postScript = request.postRequestScript ?? request.tests;
      if (postScript) {
        const postContext: ScriptContext = { ...scriptContext, response };
        tests = await this.scriptEngine.executePostRequestScript(postScript, postContext);
      }
    } catch (err: any) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      request,
      response,
      tests,
      error,
      totalTime: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line no-restricted-globals
    setTimeout(resolve, ms);
  });
}

/**
 * Flatten all requests from a collection (top-level + all nested folders).
 */
function flattenRequests(collection: Collection): HttpRequest[] {
  const requests: HttpRequest[] = [...collection.requests];
  for (const folder of collection.folders) {
    flattenFolderRequests(folder, requests);
  }
  return requests;
}

function flattenFolderRequests(folder: Folder, acc: HttpRequest[]): void {
  acc.push(...folder.requests);
  for (const sub of folder.folders) {
    flattenFolderRequests(sub, acc);
  }
}
