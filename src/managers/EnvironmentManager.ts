import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Data Models  (Task 4.1.1)
// ---------------------------------------------------------------------------

/**
 * Variable interface for environment and global variables.
 * Requirement 4.2: Environment_Manager SHALL support Global, Collection, Environment, and Local scopes.
 */
export interface Variable {
  key: string;
  value: string;
  type: 'default' | 'secret';
  enabled: boolean;
}

/**
 * Environment interface.
 * Requirement 4.1: Environment_Manager SHALL store environment-specific variables.
 */
export interface Environment {
  id: string;
  name: string;
  variables: Variable[];
}

/**
 * Variable scope enumeration.
 * Requirement 4.2: Support Global, Collection, Environment, and Local scopes.
 */
export enum VariableScope {
  Global = 'global',
  Collection = 'collection',
  Environment = 'environment',
  Local = 'local',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// EnvironmentManager  (Tasks 4.1.2 – 4.1.6)
// ---------------------------------------------------------------------------

/**
 * EnvironmentManager manages environments and their variables.
 *
 * Responsibilities:
 *  - Create / delete environments (4.1.2)
 *  - CRUD operations for variables within environments (4.1.3)
 *  - Switch active environment (4.1.4)
 *  - Manage global variables shared across all environments (4.1.5)
 *  - Mask secret variable values in UI (4.1.6)
 */
export class EnvironmentManager {
  private environments: Environment[] = [];
  private activeEnvironmentId: string | null = null;
  private globalVariables: Variable[] = [];

  // -------------------------------------------------------------------------
  // 4.1.2 – Environment creation and deletion
  // -------------------------------------------------------------------------

  /**
   * Create a new environment with a unique ID.
   * Requirement 4.1: Environment_Manager SHALL store environment-specific variables.
   */
  createEnvironment(name: string): Environment {
    const environment: Environment = {
      id: generateId(),
      name,
      variables: [],
    };
    this.environments.push(environment);
    return environment;
  }

  /**
   * Delete an environment by ID.
   * Returns true if found and removed, false otherwise.
   */
  deleteEnvironment(environmentId: string): boolean {
    const idx = this.environments.findIndex((e) => e.id === environmentId);
    if (idx === -1) {
      return false;
    }
    this.environments.splice(idx, 1);
    if (this.activeEnvironmentId === environmentId) {
      this.activeEnvironmentId = null;
    }
    return true;
  }

  duplicateEnvironment(environmentId: string): Environment | null {
    const source = this.getEnvironmentById(environmentId);
    if (!source) return null;
    const allNames = this.environments.map((e) => e.name);
    let copyName = source.name + ' (Copy)';
    let n = 2;
    while (allNames.includes(copyName)) {
      copyName = `${source.name} (Copy${n})`;
      n++;
    }
    const duplicate: Environment = {
      id: generateId(),
      name: copyName,
      variables: source.variables.map((v) => ({ ...v })),
    };
    this.environments.push(duplicate);
    return duplicate;
  }

  renameEnvironment(environmentId: string, newName: string): boolean {
    const env = this.getEnvironmentById(environmentId);
    if (!env) return false;
    env.name = newName;
    return true;
  }

  // -------------------------------------------------------------------------
  // 4.1.3 – Variable CRUD operations
  // -------------------------------------------------------------------------

  /**
   * Add or update a variable in an environment.
   * If a variable with the same key already exists, it is updated.
   */
  setVariable(environmentId: string, variable: Variable): void {
    const env = this.getEnvironmentById(environmentId);
    if (!env) {
      throw new Error(`Environment "${environmentId}" not found`);
    }
    const existing = env.variables.findIndex((v) => v.key === variable.key);
    if (existing !== -1) {
      env.variables[existing] = { ...variable };
    } else {
      env.variables.push({ ...variable });
    }
  }

  /**
   * Get a variable value from an environment by key.
   * Returns undefined if the environment or variable is not found, or if disabled.
   */
  getVariable(environmentId: string, key: string): string | undefined {
    const env = this.getEnvironmentById(environmentId);
    if (!env) {
      return undefined;
    }
    const variable = env.variables.find((v) => v.key === key && v.enabled);
    return variable?.value;
  }

  /**
   * Delete a variable from an environment by key.
   * Returns true if found and removed, false otherwise.
   */
  deleteVariable(environmentId: string, key: string): boolean {
    const env = this.getEnvironmentById(environmentId);
    if (!env) {
      return false;
    }
    const idx = env.variables.findIndex((v) => v.key === key);
    if (idx === -1) {
      return false;
    }
    env.variables.splice(idx, 1);
    return true;
  }

  /**
   * Get all variables for an environment.
   * Secret variables have their values masked as "****" for UI display.
   * Requirement 4.4: Environment_Manager SHALL mask the variable value in the UI.
   */
  getVariablesForDisplay(environmentId: string): Variable[] {
    const env = this.getEnvironmentById(environmentId);
    if (!env) {
      return [];
    }
    return env.variables.map((v) => this.maskSecretForDisplay(v));
  }

  // -------------------------------------------------------------------------
  // 4.1.4 – Active environment switching
  // -------------------------------------------------------------------------

  /**
   * Set the active environment by ID.
   * Requirement 4.5: Environment_Manager SHALL update all variable resolutions to use the active environment.
   */
  setActiveEnvironment(environmentId: string): void {
    const env = this.getEnvironmentById(environmentId);
    if (!env) {
      throw new Error(`Environment "${environmentId}" not found`);
    }
    this.activeEnvironmentId = environmentId;
  }

  /**
   * Clear the active environment (no environment selected).
   */
  clearActiveEnvironment(): void {
    this.activeEnvironmentId = null;
  }

  /**
   * Get the currently active environment, or null if none is set.
   */
  getActiveEnvironment(): Environment | null {
    if (!this.activeEnvironmentId) {
      if (this.environments.length > 0) {
        this.activeEnvironmentId = this.environments[0]!.id;
      } else {
        return null;
      }
    }
    return this.getEnvironmentById(this.activeEnvironmentId) ?? null;
  }

  // -------------------------------------------------------------------------
  // 4.1.5 – Global variables management
  // -------------------------------------------------------------------------

  /**
   * Set a global variable (shared across all environments).
   * If a variable with the same key exists, it is updated.
   */
  setGlobalVariable(variable: Variable): void {
    const existing = this.globalVariables.findIndex((v) => v.key === variable.key);
    if (existing !== -1) {
      this.globalVariables[existing] = { ...variable };
    } else {
      this.globalVariables.push({ ...variable });
    }
  }

  /**
   * Get a global variable value by key.
   * Returns undefined if not found or disabled.
   */
  getGlobalVariable(key: string): string | undefined {
    const variable = this.globalVariables.find((v) => v.key === key && v.enabled);
    return variable?.value;
  }

  /**
   * Delete a global variable by key.
   */
  deleteGlobalVariable(key: string): boolean {
    const idx = this.globalVariables.findIndex((v) => v.key === key);
    if (idx === -1) {
      return false;
    }
    this.globalVariables.splice(idx, 1);
    return true;
  }

  /**
   * Get all global variables.
   * Secret variables have their values masked as "****" for UI display.
   */
  getGlobalVariablesForDisplay(): Variable[] {
    return this.globalVariables.map((v) => this.maskSecretForDisplay(v));
  }

  /**
   * Get all global variables (raw, with actual values).
   */
  getGlobalVariables(): Variable[] {
    return [...this.globalVariables];
  }

  setGlobalVariables(variables: Variable[]): void {
    this.globalVariables = [...variables];
  }

  // -------------------------------------------------------------------------
  // 4.1.6 – Secret variable masking in UI
  // -------------------------------------------------------------------------

  /**
   * Return a copy of the variable with the value masked if it is a secret.
   * Requirement 4.4: Environment_Manager SHALL mask the variable value in the UI.
   */
  maskSecretForDisplay(variable: Variable): Variable {
    if (variable.type === 'secret') {
      return { ...variable, value: '****' };
    }
    return { ...variable };
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Get all environments */
  getEnvironments(): Environment[] {
    return this.environments;
  }

  /** Get an environment by ID */
  getEnvironmentById(environmentId: string): Environment | undefined {
    return this.environments.find((e) => e.id === environmentId);
  }

  /** Replace the in-memory environments (e.g. after loading from storage) */
  setEnvironments(environments: Environment[]): void {
    this.environments = environments;
  }
}
