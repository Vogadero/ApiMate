import * as crypto from 'crypto';
import { Variable } from './EnvironmentManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Context object providing variable scopes for resolution.
 * Precedence (highest to lowest): local > iterationData > environment > collection > global
 * Requirement 4.3: Variable_Resolver SHALL resolve variables with precedence: Local > Environment > Collection > Global
 * Requirement 11.5: Iteration data has higher precedence than environment variables.
 */
export interface VariableContext {
  globalVariables?: Variable[];
  collectionVariables?: Variable[];
  environmentVariables?: Variable[];
  localVariables?: Variable[];
  iterationData?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// VariableResolver  (Tasks 4.2.1 – 4.2.6)
// ---------------------------------------------------------------------------

/**
 * VariableResolver resolves {{variableName}} placeholders in strings.
 *
 * Responsibilities:
 *  - Variable resolution with precedence rules (4.2.1)
 *  - {{variableName}} placeholder detection and replacement (4.2.2)
 *  - Recursive variable resolution (4.2.3)
 *  - Dynamic variable generation: $timestamp, $randomInt, $guid, $randomString (4.2.4)
 *  - Faker.js integration for {{$faker.category.method}} syntax (4.2.5)
 *  - Resolve variables in URL, headers, and body (4.2.6)
 */
export class VariableResolver {
  /** Maximum recursion depth to prevent infinite loops */
  private static readonly MAX_DEPTH = 10;

  /** Regex that matches {{anything}} placeholders */
  private static readonly PLACEHOLDER_REGEX = /\{\{([^{}]+?)\}\}/g;

  // -------------------------------------------------------------------------
  // 4.2.1 / 4.2.2 – Core resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve all {{variableName}} placeholders in a string using the provided context.
   * Requirement 4.3: Precedence: Local > Iteration > Environment > Collection > Global
   */
  resolve(text: string, context: VariableContext = {}): string {
    return this.resolveRecursive(text, context, 0);
  }

  /**
   * Resolve a single placeholder name (without the {{ }}) to its value.
   * Returns undefined if the placeholder cannot be resolved.
   */
  resolvePlaceholder(name: string, context: VariableContext): string | undefined {
    const trimmed = name.trim();

    // Dynamic variables start with $
    if (trimmed.startsWith('$')) {
      return this.generateDynamicVariable(trimmed);
    }

    // Walk scopes in precedence order: local > iterationData > environment > collection > global
    const value = this.lookupInScopes(trimmed, context);
    return value;
  }

  // -------------------------------------------------------------------------
  // 4.2.3 – Recursive variable resolution
  // -------------------------------------------------------------------------

  /**
   * Recursively resolve placeholders up to MAX_DEPTH levels deep.
   * This handles variables whose values themselves contain {{placeholders}}.
   */
  private resolveRecursive(text: string, context: VariableContext, depth: number): string {
    if (depth >= VariableResolver.MAX_DEPTH) {
      return text;
    }

    const resolved = text.replace(VariableResolver.PLACEHOLDER_REGEX, (_match, name: string) => {
      const value = this.resolvePlaceholder(name, context);
      if (value === undefined) {
        return _match; // leave unresolved placeholders as-is
      }
      return value;
    });

    // If the result still contains placeholders and something changed, recurse
    if (resolved !== text && VariableResolver.PLACEHOLDER_REGEX.test(resolved)) {
      // Reset lastIndex since we used the global regex
      VariableResolver.PLACEHOLDER_REGEX.lastIndex = 0;
      return this.resolveRecursive(resolved, context, depth + 1);
    }

    VariableResolver.PLACEHOLDER_REGEX.lastIndex = 0;
    return resolved;
  }

  // -------------------------------------------------------------------------
  // 4.2.4 – Dynamic variable generation
  // -------------------------------------------------------------------------

  /**
   * Generate a value for a dynamic variable expression (e.g. "$timestamp", "$guid").
   * Requirement 5.2-5.5: Support $timestamp, $randomInt, $guid, $randomString, $faker.*
   */
  generateDynamicVariable(expression: string): string {
    const expr = expression.startsWith('$') ? expression.slice(1) : expression;

    // $faker.category.method  (4.2.5)
    if (expr.startsWith('faker.')) {
      return this.invokeFaker(expr.slice('faker.'.length));
    }

    switch (expr) {
      case 'timestamp':
        return this.generateTimestamp();
      case 'randomInt':
        return this.generateRandomInt();
      case 'guid':
        return this.generateGuid();
      case 'randomString':
        return this.generateRandomString();
      default:
        return `{{$${expr}}}`; // unknown dynamic variable – return as-is
    }
  }

  /** Current Unix timestamp in milliseconds */
  private generateTimestamp(): string {
    return String(Date.now());
  }

  /** Random integer between 0 and 1000 (inclusive) */
  private generateRandomInt(min = 0, max = 1000): string {
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  /** UUID v4 */
  private generateGuid(): string {
    return crypto.randomUUID();
  }

  /** Random alphanumeric string of 10 characters */
  private generateRandomString(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // 4.2.5 – Faker.js integration
  // -------------------------------------------------------------------------

  /**
   * Invoke a Faker.js method using dot-notation path (e.g. "name.firstName").
   * Requirement 5.5: Variable_Resolver SHALL invoke the corresponding Faker.js method.
   */
  private invokeFaker(path: string): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const fakerModule = require('faker') as Record<string, unknown>;
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      let current: any = fakerModule;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return `{{$faker.${path}}}`;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        current = current[part];
      }
      if (typeof current === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return String(current());
      }
      return `{{$faker.${path}}}`;
    } catch {
      return `{{$faker.${path}}}`;
    }
  }

  // -------------------------------------------------------------------------
  // 4.2.6 – Resolve variables in URL, headers, and body
  // -------------------------------------------------------------------------

  /**
   * Resolve all variables in a URL string.
   */
  resolveUrl(url: string, context: VariableContext): string {
    return this.resolve(url, context);
  }

  /**
   * Resolve all variables in a headers map.
   * Returns a new object with all values resolved.
   */
  resolveHeaders(headers: Record<string, string>, context: VariableContext): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      resolved[key] = this.resolve(value, context);
    }
    return resolved;
  }

  /**
   * Resolve all variables in a body string.
   */
  resolveBody(body: string, context: VariableContext): string {
    return this.resolve(body, context);
  }

  // -------------------------------------------------------------------------
  // Scope lookup helpers
  // -------------------------------------------------------------------------

  /**
   * Look up a variable key across all scopes in precedence order.
   * Precedence: local > iterationData > environment > collection > global
   */
  private lookupInScopes(key: string, context: VariableContext): string | undefined {
    // 1. Local variables (highest precedence)
    const localValue = this.lookupInVariables(key, context.localVariables);
    if (localValue !== undefined) {
      return localValue;
    }

    // 2. Iteration data
    if (context.iterationData && key in context.iterationData) {
      return String(context.iterationData[key]);
    }

    // 3. Environment variables
    const envValue = this.lookupInVariables(key, context.environmentVariables);
    if (envValue !== undefined) {
      return envValue;
    }

    // 4. Collection variables
    const colValue = this.lookupInVariables(key, context.collectionVariables);
    if (colValue !== undefined) {
      return colValue;
    }

    // 5. Global variables (lowest precedence)
    return this.lookupInVariables(key, context.globalVariables);
  }

  /**
   * Find the value of a key in a variable array.
   * Only returns enabled variables.
   */
  private lookupInVariables(key: string, variables?: Variable[]): string | undefined {
    if (!variables) {
      return undefined;
    }
    const variable = variables.find((v) => v.key === key && v.enabled);
    return variable?.value;
  }
}
