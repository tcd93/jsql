import { ConnectionProfile, DatabaseProvider } from "../../types";
import { ConnectionService } from "../connection";
import { PostgresService } from "../connection/providers/PostgresService";
import { ISchemaQueryBuilder } from "../schema";
import { PostgresSchemaQueryBuilder } from "../schema/builders/PostgresSchemaQueryBuilder";
import { AbstractDatabaseFactory } from "./AbstractDatabaseFactory";

export class PostgresFactory extends AbstractDatabaseFactory {
  private readonly connectionServiceCache = new Map<
    string,
    ConnectionService
  >();
  private readonly queryBuilder = new PostgresSchemaQueryBuilder();

  getProvider(): DatabaseProvider {
    return DatabaseProvider.PostgreSQL;
  }

  dispose(): void {
    this.connectionServiceCache.forEach(service => service.dispose());
    this.connectionServiceCache.clear();
  }

  getConnectionService(
    connectionProfile: ConnectionProfile
  ): ConnectionService {
    const cacheKey = this.getCacheKey(connectionProfile);
    let service = this.connectionServiceCache.get(cacheKey);

    if (!service) {
      service = new PostgresService();
      this.connectionServiceCache.set(cacheKey, service);
    }
    return service;
  }

  getSchemaQueryBuilder(): ISchemaQueryBuilder {
    return this.queryBuilder;
  }

  /**
   * Generates a cache key specific to PostgreSQL connections.
   * Includes provider-specific fields like connection string.
   */
  protected getCacheKey(profile: ConnectionProfile): string {
    const pgProfile = profile as import("../../types").PostgreSqlConnectionProfile;
    
    const parts = [
      profile.provider,
      profile.host,
      profile.port,
      profile.database ?? "",
      profile.username ?? "",
      profile.password ?? "",
    ];

    // Normalize connection string if provided
    if (pgProfile.connectionString) {
      const normalizedConnectionString = this.normalizeConnectionString(
        pgProfile.connectionString
      );
      parts.push(normalizedConnectionString);
    } else {
      parts.push("");
    }

    return parts.join("|");
  }
}

// Register this factory when the module is loaded
AbstractDatabaseFactory.registerFactory(
  DatabaseProvider.PostgreSQL,
  async () => new PostgresFactory()
);
