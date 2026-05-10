import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Collection } from './CollectionManager';

/**
 * Environment interface
 */
export interface Environment {
  id: string;
  name: string;
  variables: Array<{
    key: string;
    value: string;
    type: 'default' | 'secret';
    enabled: boolean;
  }>;
}

/** Versioned wrapper written to disk for each collection file. */
interface CollectionFile {
  version: string;
  id: string;
  name: string;
  folders: Collection['folders'];
  requests: Collection['requests'];
  variables: Collection['variables'];
  auth?: Collection['auth'];
  preRequestScript?: string;
  postRequestScript?: string;
}

/** Versioned wrapper written to disk for each environment file. */
interface EnvironmentFile {
  version: string;
  id: string;
  name: string;
  variables: Environment['variables'];
}

const FILE_VERSION = '1.0';

/** Namespaced key prefix for environment secrets stored in SecretStorage. */
const SECRET_KEY_PREFIX = 'apimate.env.secret.';

/**
 * Returns the namespaced SecretStorage key for a given environment variable.
 */
function secretKey(environmentId: string, variableKey: string): string {
  return `${SECRET_KEY_PREFIX}${environmentId}.${variableKey}`;
}

/**
 * Configured storage paths returned by getStoragePaths().
 */
export interface StoragePaths {
  workspacePath: string;
  apimateRoot: string;
  collectionPath: string;
  environmentPath: string;
}

/**
 * StorageManager handles file-system persistence and secret storage.
 * Collections and environments are stored as JSON files under .vscode/apimate/
 * Secrets are stored using VS Code's SecretStorage API.
 */
export class StorageManager {
  readonly workspacePath: string;
  readonly collectionPath: string;
  readonly environmentPath: string;

  constructor(private context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    this.workspacePath = workspaceFolder.uri.fsPath;
    this.collectionPath = path.join(this.workspacePath, '.vscode', 'apimate', 'collections');
    this.environmentPath = path.join(this.workspacePath, '.vscode', 'apimate', 'environments');

    this.ensureDirectories();
  }

  /**
   * Ensure storage directories exist, creating them if necessary.
   */
  private ensureDirectories(): void {
    const dirs = [
      path.join(this.workspacePath, '.vscode'),
      path.join(this.workspacePath, '.vscode', 'apimate'),
      this.collectionPath,
      this.environmentPath,
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Returns the configured workspace-specific storage paths.
   * Requirement 21.5: Isolate storage per workspace.
   * Task 1.3.6: Expose storage paths for inspection.
   */
  getStoragePaths(): StoragePaths {
    return {
      workspacePath: this.workspacePath,
      apimateRoot: path.join(this.workspacePath, '.vscode', 'apimate'),
      collectionPath: this.collectionPath,
      environmentPath: this.environmentPath,
    };
  }

  // ---------------------------------------------------------------------------
  // Collection persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a collection to the file system as a versioned JSON file.
   * Requirement 2.5 / 21.1-21.2: Collections stored in .vscode directory in Git-friendly JSON format.
   */
  async saveCollection(collection: Collection): Promise<void> {
    try {
      const filePath = path.join(this.collectionPath, `${collection.id}.json`);
      const fileData: CollectionFile = {
        version: FILE_VERSION,
        id: collection.id,
        name: collection.name,
        folders: collection.folders,
        requests: collection.requests,
        variables: collection.variables,
      };
      if (collection.auth !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        fileData.auth = collection.auth;
      }
      if (collection.preRequestScript !== undefined) {
        fileData.preRequestScript = collection.preRequestScript;
      }
      if (collection.postRequestScript !== undefined) {
        fileData.postRequestScript = collection.postRequestScript;
      }
      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to save collection "${collection.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a collection file from the file system.
   * Requirement 21.2: Collection modifications (including deletion) update the file system.
   */
  async deleteCollection(collectionId: string): Promise<void> {
    const filePath = path.join(this.collectionPath, `${collectionId}.json`);
    if (!fs.existsSync(filePath)) {
      return; // idempotent – deleting a non-existent collection is a no-op
    }
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      throw new Error(
        `Failed to delete collection "${collectionId}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load all collections from the file system.
   * Requirement 21.3: Extension loads collection files from .vscode directory.
   */
  async loadCollections(): Promise<Collection[]> {
    const collections: Collection[] = [];

    if (!fs.existsSync(this.collectionPath)) {
      return collections;
    }

    let files: string[];
    try {
      files = fs.readdirSync(this.collectionPath);
    } catch (error) {
      throw new Error(
        `Failed to read collections directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(this.collectionPath, file);
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data) as CollectionFile;
        const collection: Collection = {
          id: parsed.id,
          name: parsed.name,
          folders: parsed.folders ?? [],
          requests: parsed.requests ?? [],
          variables: parsed.variables ?? [],
        };
        if (parsed.auth !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          collection.auth = parsed.auth;
        }
        if (parsed.preRequestScript !== undefined) {
          collection.preRequestScript = parsed.preRequestScript;
        }
        if (parsed.postRequestScript !== undefined) {
          collection.postRequestScript = parsed.postRequestScript;
        }
        collections.push(collection);
      } catch (error) {
        // Log and skip malformed files rather than failing the entire load
        console.error(
          `Failed to load collection from "${file}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return collections;
  }

  // ---------------------------------------------------------------------------
  // Environment persistence  (Task 1.3.3)
  // ---------------------------------------------------------------------------

  /**
   * Save an environment to the file system as a versioned JSON file.
   * Secret variable values are stripped from the file and stored in SecretStorage.
   * Requirement 22.3: Secret variables excluded from JSON file.
   * Task 1.3.3: Versioned format, all fields serialized, secret handling.
   */
  async saveEnvironment(environment: Environment): Promise<void> {
    try {
      const filePath = path.join(this.environmentPath, `${environment.id}.json`);

      // Strip secret values – replace with a reference key so the file is safe to commit.
      const sanitizedVariables = environment.variables.map((v) => {
        if (v.type === 'secret') {
          return { ...v, value: `secret-ref:${secretKey(environment.id, v.key)}` };
        }
        return { ...v };
      });

      // Store actual secret values in SecretStorage (Task 1.3.4).
      for (const v of environment.variables) {
        if (v.type === 'secret') {
          await this.saveSecret(secretKey(environment.id, v.key), v.value);
        }
      }

      const fileData: EnvironmentFile = {
        version: FILE_VERSION,
        id: environment.id,
        name: environment.name,
        variables: sanitizedVariables,
      };

      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to save environment "${environment.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete an environment file from the file system.
   * Task 1.3.3: deleteEnvironment method.
   */
  async deleteEnvironment(environmentId: string): Promise<void> {
    const filePath = path.join(this.environmentPath, `${environmentId}.json`);
    if (!fs.existsSync(filePath)) {
      return; // idempotent
    }
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      throw new Error(
        `Failed to delete environment "${environmentId}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load all environments from the file system (without restoring secret values).
   * Requirement 21.3 / 22.4: Load environments; secrets retrieved separately.
   */
  async loadAllEnvironmentsWithSecrets(): Promise<Environment[]> {
    const environments: Environment[] = [];
    if (!fs.existsSync(this.environmentPath)) {
      return environments;
    }
    let files: string[];
    try {
      files = fs.readdirSync(this.environmentPath);
    } catch (error) {
      throw new Error(`Failed to read environments directory: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const file of files) {
      if (!file.endsWith('.json') || file.startsWith('_')) continue;
      const filePath = path.join(this.environmentPath, file);
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data) as EnvironmentFile;
        const variables = await Promise.all(
          (parsed.variables ?? []).map(async (v) => {
            if (v.type === 'secret') {
              const storedValue = await this.getSecret(secretKey(parsed.id, v.key));
              return { ...v, value: storedValue ?? '' };
            }
            return { ...v };
          }),
        );
        environments.push({ id: parsed.id, name: parsed.name, variables });
      } catch (error) {
        console.error(`Failed to load environment from "${file}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return environments;
  }

  async loadEnvironments(): Promise<Environment[]> {
    const environments: Environment[] = [];

    if (!fs.existsSync(this.environmentPath)) {
      return environments;
    }

    let files: string[];
    try {
      files = fs.readdirSync(this.environmentPath);
    } catch (error) {
      throw new Error(
        `Failed to read environments directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(this.environmentPath, file);
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data) as EnvironmentFile;
        const environment: Environment = {
          id: parsed.id,
          name: parsed.name,
          variables: parsed.variables ?? [],
        };
        environments.push(environment);
      } catch (error) {
        console.error(
          `Failed to load environment from "${file}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return environments;
  }

  /**
   * Load an environment and restore secret variable values from SecretStorage.
   * Requirement 22.4: Extension retrieves secrets from SecretStorage on load.
   * Task 1.3.4: loadEnvironmentWithSecrets restores secret values.
   */
  async loadEnvironmentWithSecrets(environmentId: string): Promise<Environment | undefined> {
    const filePath = path.join(this.environmentPath, `${environmentId}.json`);
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    let parsed: EnvironmentFile;
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      parsed = JSON.parse(data) as EnvironmentFile;
    } catch (error) {
      throw new Error(
        `Failed to load environment "${environmentId}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Restore secret values from SecretStorage.
    const variables = await Promise.all(
      parsed.variables.map(async (v) => {
        if (v.type === 'secret') {
          const storedValue = await this.getSecret(secretKey(environmentId, v.key));
          return { ...v, value: storedValue ?? '' };
        }
        return { ...v };
      }),
    );

    return {
      id: parsed.id,
      name: parsed.name,
      variables,
    };
  }

  // ---------------------------------------------------------------------------
  // Secret storage  (Task 1.3.4)
  // ---------------------------------------------------------------------------

  /**
   * Save a secret value using VS Code's SecretStorage API.
   * Requirement 22.1: Secrets stored using VS Code SecretStorage.
   */
  async saveSecret(key: string, value: string): Promise<void> {
    try {
      await this.context.secrets.store(key, value);
    } catch (error) {
      throw new Error(
        `Failed to save secret "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieve a secret value from VS Code's SecretStorage API.
   * Requirement 22.4: Extension retrieves secrets from SecretStorage on load.
   */
  async getSecret(key: string): Promise<string | undefined> {
    try {
      return await this.context.secrets.get(key);
    } catch (error) {
      throw new Error(
        `Failed to get secret "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a secret from VS Code's SecretStorage API.
   * Requirement 22.5: Deleted secrets removed from SecretStorage.
   */
  async deleteSecret(key: string): Promise<void> {
    try {
      await this.context.secrets.delete(key);
    } catch (error) {
      throw new Error(
        `Failed to delete secret "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Global variables persistence
  // ---------------------------------------------------------------------------

  async saveGlobalVariables(variables: Array<{ key: string; value: string; type: 'default' | 'secret'; enabled: boolean }>): Promise<void> {
    const filePath = path.join(this.environmentPath, '_globals.json');
    const sanitizedVariables = variables.map((v) => {
      if (v.type === 'secret') {
        return { ...v, value: `secret-ref:apimate.env.secret._globals.${v.key}` };
      }
      return { ...v };
    });
    for (const v of variables) {
      if (v.type === 'secret') {
        await this.saveSecret(`apimate.env.secret._globals.${v.key}`, v.value);
      }
    }
    const data = { version: '1.0', id: '_globals', name: 'Globals', variables: sanitizedVariables };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async loadGlobalVariables(): Promise<Array<{ key: string; value: string; type: 'default' | 'secret'; enabled: boolean }>> {
    const filePath = path.join(this.environmentPath, '_globals.json');
    if (!fs.existsSync(filePath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const variables = (data.variables || []) as Array<{ key: string; value: string; type: 'default' | 'secret'; enabled: boolean }>;
      for (const v of variables) {
        if (v.type === 'secret' && v.value.startsWith('secret-ref:')) {
          const secretKey = v.value.replace('secret-ref:', '');
          const secretValue = await this.getSecret(secretKey);
          if (secretValue !== undefined) {
            v.value = secretValue;
          }
        }
      }
      return variables;
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // .env file import
  // ---------------------------------------------------------------------------

  parseEnvFile(content: string): Array<{ key: string; value: string; type: 'default' | 'secret'; enabled: boolean }> {
    const variables: Array<{ key: string; value: string; type: 'default' | 'secret'; enabled: boolean }> = [];
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      let key = line.substring(0, eqIdx).trim();
      let value = line.substring(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      const inlineComment = value.match(/\s+#.*$/);
      if (inlineComment && !value.startsWith('"') && !value.startsWith("'")) {
        value = value.substring(0, inlineComment.index!).trim();
      }
      const isSecret = /password|secret|token|key|auth|credential/i.test(key);
      variables.push({ key, value, type: isSecret ? 'secret' : 'default', enabled: true });
    }
    return variables;
  }

  // ---------------------------------------------------------------------------
  // File watchers  (Task 1.3.5)
  // ---------------------------------------------------------------------------

  /**
   * Watch collection files for external changes (create, change, delete) and
   * invoke the appropriate callback.
   * Requirement 21.4: Detect external collection file changes and reload.
   * Task 1.3.5: Handle creation and deletion events in addition to changes.
   */
  watchCollectionFiles(callbacks: {
    onChange?: (collection: Collection) => void;
    onCreate?: (collection: Collection) => void;
    onDelete?: (collectionId: string) => void;
  }): vscode.FileSystemWatcher {
    const pattern = new vscode.RelativePattern(this.collectionPath, '*.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const loadCollection = (uri: vscode.Uri): Collection | null => {
      try {
        const data = fs.readFileSync(uri.fsPath, 'utf-8');
        return JSON.parse(data) as Collection;
      } catch (error) {
        console.error(
          `Failed to reload collection from "${uri.fsPath}": ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    };

    watcher.onDidChange((uri) => {
      if (callbacks.onChange) {
        const collection = loadCollection(uri);
        if (collection) {
          callbacks.onChange(collection);
        }
      }
    });

    watcher.onDidCreate((uri) => {
      if (callbacks.onCreate) {
        const collection = loadCollection(uri);
        if (collection) {
          callbacks.onCreate(collection);
        }
      }
    });

    watcher.onDidDelete((uri) => {
      if (callbacks.onDelete) {
        // Derive the collection id from the filename (strip .json extension).
        const collectionId = path.basename(uri.fsPath, '.json');
        callbacks.onDelete(collectionId);
      }
    });

    return watcher;
  }

  /**
   * Watch environment files for external changes (create, change, delete) and
   * invoke the appropriate callback.
   * Task 1.3.5: watchEnvironmentFiles mirrors watchCollectionFiles for environments.
   */
  watchEnvironmentFiles(callbacks: {
    onChange?: (environment: Environment) => void;
    onCreate?: (environment: Environment) => void;
    onDelete?: (environmentId: string) => void;
  }): vscode.FileSystemWatcher {
    const pattern = new vscode.RelativePattern(this.environmentPath, '*.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const loadEnvironmentWithSecrets = async (uri: vscode.Uri): Promise<Environment | null> => {
      try {
        const data = fs.readFileSync(uri.fsPath, 'utf-8');
        const parsed = JSON.parse(data) as EnvironmentFile;
        const variables = await Promise.all(
          (parsed.variables ?? []).map(async (v) => {
            if (v.type === 'secret') {
              const storedValue = await this.getSecret(secretKey(parsed.id, v.key));
              return { ...v, value: storedValue ?? '' };
            }
            return { ...v };
          }),
        );
        return { id: parsed.id, name: parsed.name, variables };
      } catch (error) {
        console.error(`Failed to reload environment from "${uri.fsPath}": ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };

    watcher.onDidChange(async (uri) => {
      if (callbacks.onChange) {
        const environment = await loadEnvironmentWithSecrets(uri);
        if (environment) {
          callbacks.onChange(environment);
        }
      }
    });

    watcher.onDidCreate(async (uri) => {
      if (callbacks.onCreate) {
        const environment = await loadEnvironmentWithSecrets(uri);
        if (environment) {
          callbacks.onCreate(environment);
        }
      }
    });

    watcher.onDidDelete((uri) => {
      if (callbacks.onDelete) {
        const environmentId = path.basename(uri.fsPath, '.json');
        callbacks.onDelete(environmentId);
      }
    });

    return watcher;
  }
}
