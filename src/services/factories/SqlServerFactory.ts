import { ConnectionProfile, DatabaseProvider } from "../../types";
import { ConnectionService } from "../connection";
import { SqlServerService } from "../connection/providers/SqlServerService";
import { ISchemaQueryBuilder } from "../schema";
import { SqlServerSchemaQueryBuilder } from "../schema/builders/SqlServerSchemaQueryBuilder";
import { AbstractDatabaseFactory } from "./AbstractDatabaseFactory";

export class SqlServerFactory extends AbstractDatabaseFactory {
  private readonly connectionServiceCache = new Map<
    string,
    ConnectionService
  >();
  private readonly queryBuilder = new SqlServerSchemaQueryBuilder();

  getProvider(): DatabaseProvider {
    return DatabaseProvider.SqlServer;
  }

  dispose(): void {
    super.dispose();
    this.connectionServiceCache.forEach(service => service.dispose());
    this.connectionServiceCache.clear();
  }

  getConnectionService(
    connectionProfile: ConnectionProfile
  ): ConnectionService {
    const cacheKey = this.getCacheKey(connectionProfile);
    let service = this.connectionServiceCache.get(cacheKey);

    if (!service) {
      service = new SqlServerService();
      this.connectionServiceCache.set(cacheKey, service);
    }
    return service;
  }

  getSchemaQueryBuilder(): ISchemaQueryBuilder {
    return this.queryBuilder;
  }

  /**
   * Generates a cache key specific to SQL Server connections.
   * Includes provider-specific fields like authentication method,
   * connection string, and server SPN.
   */
  protected getCacheKey(profile: ConnectionProfile): string {
    const sqlProfile = profile as import("../../types").SqlServerConnectionProfile;
    
    const parts = [
      profile.provider,
      profile.host,
      profile.port,
      profile.database ?? "",
      profile.username ?? "",
      profile.password ?? "",
      sqlProfile.authentication ?? "",
      sqlProfile.serverSPN ?? "",
    ];

    // Normalize connection string if provided
    if (sqlProfile.connectionString) {
      const normalizedConnectionString = this.normalizeConnectionString(
        sqlProfile.connectionString
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
  DatabaseProvider.SqlServer,
  async () => new SqlServerFactory()
);
