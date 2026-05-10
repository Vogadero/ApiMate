import * as vscode from 'vscode';
import * as vm from 'vm';
import * as chai from 'chai';
import * as http from 'http';
import * as https from 'https';
import { EnvironmentManager } from './EnvironmentManager';
import { HttpRequest, HttpResponse } from './RequestManager';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Result of a single pm.test() call.
 * Requirement 9: Script_Engine SHALL support Chai.js assertion syntax.
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * Context passed into script execution.
 * Requirement 8: Script_Engine SHALL execute scripts with access to request/response.
 */
export interface ScriptContext {
  request: HttpRequest;
  response?: HttpResponse;
  environment: EnvironmentManager;
  /** Local variable store (script-scoped) */
  localVariables?: Map<string, string>;
}

/**
 * The pm.environment API exposed to scripts.
 */
export interface PmEnvironmentAPI {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

/**
 * The pm.variables API exposed to scripts (local scope).
 */
export interface PmVariablesAPI {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

/**
 * Read-only request properties exposed to scripts.
 * Requirement 8.4: Script_Engine SHALL provide read and write access to request properties.
 */
export interface PmRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/**
 * Read-only response properties exposed to scripts.
 * Requirement 8.5: Script_Engine SHALL provide read-only access to response properties.
 */
export interface PmResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  responseTime: number;
  responseSize: number;
  json(): unknown;
  text(): string;
}

/**
 * The full pm API object exposed to scripts.
 */
export interface ScriptAPI {
  pm: {
    environment: PmEnvironmentAPI;
    variables: PmVariablesAPI;
    request: PmRequest;
    response: PmResponse | undefined;
    test(name: string, fn: () => void): void;
    expect(value: any): Chai.Assertion;
    sendRequest(url: string, callback: (err: Error | null, response: unknown) => void): void;
  };
  console: {
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
}

// ---------------------------------------------------------------------------
// ScriptEngine
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * ScriptEngine executes JavaScript code in a sandboxed vm2 environment.
 *
 * Requirements 8 & 9: Pre/post-request scripts with pm API and Chai assertions.
 */
export class ScriptEngine {
  private outputChannel: vscode.OutputChannel;

  constructor(private _context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('ApiMate Scripts');
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Execute a pre-request script.
   * Requirement 8.1: Script_Engine SHALL execute the script before sending the request.
   */
  async executePreRequestScript(script: string, context: ScriptContext): Promise<void> {
    if (!script || script.trim() === '') {
      return;
    }

    const localVars = context.localVariables ?? new Map<string, string>();
    const api = this._createScriptAPI(context, localVars, []);
    const timeout = this._getTimeout();

    try {
      await this._runInSandbox(script, api, timeout);
    } catch (err: any) {
      // Requirement 30.3: Script_Engine SHALL display the error message and stack trace.
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[Pre-request Script Error] ${message}`);
      throw err;
    }
  }

  /**
   * Execute a post-request script and return collected test results.
   * Requirement 8.2: Script_Engine SHALL execute the script after receiving the response.
   */
  async executePostRequestScript(script: string, context: ScriptContext): Promise<TestResult[]> {
    if (!script || script.trim() === '') {
      return [];
    }

    const localVars = context.localVariables ?? new Map<string, string>();
    const testResults: TestResult[] = [];
    const api = this._createScriptAPI(context, localVars, testResults);
    const timeout = this._getTimeout();

    try {
      await this._runInSandbox(script, api, timeout);
    } catch (err: any) {
      // Requirement 30.3: Script errors are caught and reported as failed test results.
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[Post-request Script Error] ${message}`);
      testResults.push({
        name: 'Script Execution',
        passed: false,
        error: message,
      });
    }

    return testResults;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Build the pm API object for use inside scripts.
   * Requirements 8.3–8.5, 9.1–9.5.
   */
  private _createScriptAPI(
    context: ScriptContext,
    localVars: Map<string, string>,
    testResults: TestResult[]
  ): ScriptAPI {
    const { request, response, environment } = context;
    const outputChannel = this.outputChannel;

    // pm.environment – backed by EnvironmentManager active environment
    const pmEnvironment: PmEnvironmentAPI = {
      get(key: string): string | undefined {
        const activeEnv = environment.getActiveEnvironment();
        if (!activeEnv) {
          return environment.getGlobalVariable(key);
        }
        return environment.getVariable(activeEnv.id, key) ?? environment.getGlobalVariable(key);
      },
      set(key: string, value: string): void {
        const activeEnv = environment.getActiveEnvironment();
        if (activeEnv) {
          environment.setVariable(activeEnv.id, {
            key,
            value,
            type: 'default',
            enabled: true,
          });
        } else {
          environment.setGlobalVariable({ key, value, type: 'default', enabled: true });
        }
      },
    };

    // pm.variables – local script-scoped store
    const pmVariables: PmVariablesAPI = {
      get(key: string): string | undefined {
        return localVars.get(key);
      },
      set(key: string, value: string): void {
        localVars.set(key, value);
      },
    };

    // pm.request – read-only view of the HttpRequest
    const pmRequest: PmRequest = {
      url: request.url,
      method: request.method,
      headers: { ...request.headers },
      body:
        request.body
          ? typeof request.body.content === 'string'
            ? request.body.content
            : undefined
          : undefined,
    };

    // pm.response – read-only view of the HttpResponse (if available)
    let pmResponse: PmResponse | undefined;
    if (response) {
      const bodyStr =
        typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
      let parsedBody: unknown = bodyStr;
      try {
        parsedBody = JSON.parse(bodyStr) as unknown;
      } catch {
        // not JSON – keep as string
      }

      pmResponse = {
        status: response.status,
        body: parsedBody,
        headers: { ...response.headers },
        responseTime: response.time,
        responseSize: response.size,
        json(): unknown {
          return typeof parsedBody === 'object' ? parsedBody : JSON.parse(bodyStr) as unknown;
        },
        text(): string {
          return bodyStr;
        },
      };
    }

    // pm.test – register a named test with Chai assertions
    const pmTest = (name: string, fn: () => void): void => {
      try {
        fn();
        testResults.push({ name, passed: true });
      } catch (err: any) {
        const error = err instanceof Error ? err.message : String(err);
        testResults.push({ name, passed: false, error });
      }
    };

    // pm.sendRequest – make an HTTP request from within a script
    const pmSendRequest = (
      urlOrOptions: string | { url: string; method?: string; header?: Record<string, string>; body?: string },
      callback: (err: Error | null, response: unknown) => void
    ): void => {
      const targetUrl = typeof urlOrOptions === 'string' ? urlOrOptions : urlOrOptions.url;
      const method = typeof urlOrOptions === 'object' ? (urlOrOptions.method ?? 'GET') : 'GET';
      const headers = typeof urlOrOptions === 'object' ? (urlOrOptions.header ?? {}) : {};
      const bodyData = typeof urlOrOptions === 'object' ? urlOrOptions.body : undefined;

      try {
        const parsed = new URL(targetUrl);
        const isHttps = parsed.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options: http.RequestOptions = {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers,
        };

        const req = transport.request(options, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const bodyText = Buffer.concat(chunks).toString('utf-8');
            let parsedResponseBody: unknown = bodyText;
            try {
              parsedResponseBody = JSON.parse(bodyText) as unknown;
            } catch {
              // keep as string
            }
            callback(null, {
              status: res.statusCode ?? 0,
              body: parsedResponseBody,
              headers: res.headers,
              text: () => bodyText,
              json: () => parsedResponseBody,
            });
          });
          res.on('error', (e) => callback(e, null));
        });

        req.on('error', (e) => callback(e, null));
        if (bodyData) {
          req.write(bodyData);
        }
        req.end();
      } catch (err: any) {
        callback(err instanceof Error ? err : new Error(String(err)), null);
      }
    };

    // Redirect console to VS Code output channel
    const scriptConsole = {
      log(...args: unknown[]): void {
        outputChannel.appendLine(`[Script] ${args.map(String).join(' ')}`);
      },
      warn(...args: unknown[]): void {
        outputChannel.appendLine(`[Script WARN] ${args.map(String).join(' ')}`);
      },
      error(...args: unknown[]): void {
        outputChannel.appendLine(`[Script ERROR] ${args.map(String).join(' ')}`);
      },
    };

    return {
      pm: {
        environment: pmEnvironment,
        variables: pmVariables,
        request: pmRequest,
        response: pmResponse,
        test: pmTest,
        expect: chai.expect,
        sendRequest: pmSendRequest,
      },
      console: scriptConsole,
    };
  }

  /**
   * Run a script string inside a vm2 sandbox with timeout.
   * Requirement 6.2.5: Script timeout handling.
   */
  private _runInSandbox(script: string, api: ScriptAPI, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const sandbox: Record<string, unknown> = {
          pm: api.pm,
          console: api.console,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          JSON,
          Math,
          Date,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          Error,
          TypeError,
          RangeError,
          SyntaxError,
          parseInt,
          parseFloat,
          isNaN,
          isFinite,
          encodeURIComponent,
          decodeURIComponent,
          encodeURI,
          decodeURI,
          undefined,
          NaN,
          Infinity,
        };

        const context = vm.createContext(sandbox);
        const compiledScript = new vm.Script(script, {
          filename: 'apimate-script.js',
        });

        compiledScript.runInContext(context, {
          timeout: timeoutMs,
        });

        resolve();
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private _getTimeout(): number {
    try {
      return (
        vscode.workspace.getConfiguration('apimate').get<number>('scriptTimeout') ??
        DEFAULT_TIMEOUT_MS
      );
    } catch {
      return DEFAULT_TIMEOUT_MS;
    }
  }
}
