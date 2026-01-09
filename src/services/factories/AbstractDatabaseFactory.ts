import * as vscode from "vscode";
import { ConnectionProfile, DatabaseProvider } from "../../types";
import { ConnectionService } from "../connection";
import { ISchemaQueryBuilder } from "../schema";

/**
 * Abstract class for database factories.
 * This class is responsible for creating and disposing database services and
 * query builders.
 */
export abstract class AbstractDatabaseFactory extends vscode.Disposable {
  private static readonly factoryRegistry = new Map<
    DatabaseProvider,
    () => Promise<AbstractDatabaseFactory>
  >();
  private static readonly factoryCache = new Map<
    DatabaseProvider,
    AbstractDatabaseFactory
  >();

  constructor() {
    super(() => {
      AbstractDatabaseFactory.dispose();
    });
  }

  /**
   * Returns the database provider this factory supports
   */
  abstract getProvider(): DatabaseProvider;

  abstract getConnectionService(
    connectionProfile: ConnectionProfile
  ): ConnectionService;

  abstract getSchemaQueryBuilder(): ISchemaQueryBuilder;

  /**
   * Generates a cache key for the given connection profile.
   * Each factory implementation should override this to include
   * provider-specific fields in the cache key.
   */
  protected abstract getCacheKey(profile: ConnectionProfile): string;

  /**
   * Registers a factory constructor for a specific provider.
   * This allows factories to register themselves without modifying
   * the AbstractDatabaseFactory class.
   */
  static registerFactory(
    provider: DatabaseProvider,
    factoryConstructor: () => Promise<AbstractDatabaseFactory>
  ): void {
    this.factoryRegistry.set(provider, factoryConstructor);
  }

  /**
   * Gets a factory instance for the specified provider.
   * Uses the registry to find and instantiate the appropriate factory.
   * Factory instances are cached for performance.
   */
  static async getFactory(
    provider: DatabaseProvider
  ): Promise<AbstractDatabaseFactory> {
    let factory = this.factoryCache.get(provider);

    if (!factory) {
      const factoryConstructor = this.factoryRegistry.get(provider);

      if (!factoryConstructor) {
        throw new Error(
          `No factory registered for provider: ${provider}. ` +
            `Available providers: ${Array.from(
              this.factoryRegistry.keys()
            ).join(", ")}`
        );
      }

      factory = await factoryConstructor();
      this.factoryCache.set(provider, factory);
    }

    return factory;
  }

  /**
   * Normalizes a connection string by removing the ApplicationName parameter.
   *
   * The MSSQL extension sets different ApplicationName values based on connection context:
   * - "vscode-mssql-Query" for query execution contexts (getCurrentConnection)
   * - "vscode-mssql-GeneralConnection-languageService" for general/language service connections (showConnectionPopup)
   *
   * Since ApplicationName is metadata used for connection tracking/identification and doesn't
   * affect connection identity (same server, credentials, database), we normalize it out to
   * ensure profiles connecting to the same database with the same credentials generate the
   * same cache key and share the same service instance.
   */
  protected normalizeConnectionString(connectionString: string): string {
    return connectionString
      .split(";")
      .filter((param) => {
        const key = param.split("=")[0]?.trim().toLowerCase();
        return key && key !== "application name";
      })
      .join(";");
  }

  /**
   * Disposes all factories and clears the factory cache and registry.
   * This should be called when the extension is deactivated.
   */
  static dispose(): void {
    this.factoryCache.forEach((factory) => factory.dispose());
    this.factoryCache.clear();
  }
}
