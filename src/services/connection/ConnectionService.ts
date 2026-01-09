import * as vscode from "vscode";
import {
  SyncQueryResult,
  StreamingCallbacks,
  ConnectionProfile,
} from "../../types";
import { AbstractDatabaseFactory } from "../factories/AbstractDatabaseFactory";

/**
 * Wrapper class for the database services such as {@link SqlServerService} and {@link PostgresService}.
 * It should be registered as a singleton service in the {@link ServiceContainer} class.
 */
export class ConnectionService extends vscode.Disposable {

  constructor() {
    super(() => {
      this.dispose();
    });
  }

  dispose(): void {
    AbstractDatabaseFactory.dispose();
  }

  /**
   * Get the connection name for the given profile and context.
   * The connection name is used in {@link ConnectionManager} to identify the connection.
   */
  protected getConnectionName(
    profile: ConnectionProfile,
    context?: vscode.TextDocument
  ): string {
    if (context) {
      return `${profile.name}-${context.uri.toString()}`;
    }
    return profile.name;
  }

  private async getService(
    profile: ConnectionProfile
  ): Promise<ConnectionService> {
    const factory = await AbstractDatabaseFactory.getFactory(profile.provider);
    const service = factory.getConnectionService(profile);
    return service;
  }

  async createConnectionPool(
    profile: ConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<void> {
    const service = await this.getService(profile);
    return service.createConnectionPool(profile, context);
  }

  async executeQuery(
    queryId: string,
    query: string,
    profile: ConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<SyncQueryResult> {
    const service = await this.getService(profile);
    return await service.executeQuery(queryId, query, profile, context);
  }

  async executeStreamingQuery(
    queryId: string,
    query: string,
    profile: ConnectionProfile,
    callbacks: StreamingCallbacks,
    context?: vscode.TextDocument
  ): Promise<CallableFunction> {
    const service = await this.getService(profile);
    return service.executeStreamingQuery(
      queryId,
      query,
      profile,
      callbacks,
      context
    );
  }

  async testConnection(
    profile: ConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<boolean> {
    const factory = await AbstractDatabaseFactory.getFactory(profile.provider);
    const queryBuilder = factory.getSchemaQueryBuilder();
    const testQuery = queryBuilder.buildTestConnectionQuery();

    const service = await this.getService(profile);
    await service.createConnectionPool(profile, context);
    const result = await service.executeQuery(
      crypto.randomUUID(),
      testQuery,
      profile,
      context
    );

    // Return true if we got a valid result with data
    return Boolean(result?.data?.rows?.length && result.data.rows.length > 0);
  }

  async closeConnection(
    profile: ConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<void> {
    const service = await this.getService(profile);
    return service.closeConnection(profile, context);
  }
}
