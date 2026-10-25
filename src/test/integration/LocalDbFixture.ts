import { randomUUID } from "node:crypto";
import * as path from "path";
import { SqlServerBridgeClient } from "../../services/connection/bridge/SqlServerBridgeClient";
import {
  CloseConnectionPayload,
  CreateConnectionPayload,
  ExecuteQueryPayload,
} from "../../types";
import { LocalDbHelper } from "./LocalDbHelper";

export class LocalDbFixture {
  public readonly databaseName = `SqlServerBridgeTest_${randomUUID().replace(
    /-/g,
    "",
  )}`;
  private readonly client = new SqlServerBridgeClient({
    extensionPath: path.resolve(__dirname, "../../../"),
  });
  private readonly masterConnectionName = "localdb-fixture-master";
  private readonly databaseConnectionName = "localdb-fixture-database";
  private masterConnectionCreated = false;
  private databaseConnectionCreated = false;

  async initialize(): Promise<void> {
    try {
      await this.createConnection(this.masterConnectionName);
      this.masterConnectionCreated = true;
    } catch (error) {
      throw new Error(
        "Could not connect to SQL Server LocalDB. Install SQL Server Express LocalDB. " +
          `Bridge error: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    await this.executeQuery(
      this.masterConnectionName,
      `CREATE DATABASE [${this.databaseName}]`,
    );
    await this.createConnection(this.databaseConnectionName, this.databaseName);
    this.databaseConnectionCreated = true;

    await this.executeQuery(
      this.databaseConnectionName,
      `CREATE TABLE [TestTable] (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        Value INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO [TestTable] (Name, Value) VALUES
        ('Item1', 10),
        ('Item2', 20),
        ('Item3', 30);`,
    );
  }

  async dispose(): Promise<void> {
    try {
      if (this.databaseConnectionCreated) {
        await this.closeConnection(this.databaseConnectionName);
        this.databaseConnectionCreated = false;
      }

      if (this.masterConnectionCreated) {
        await this.executeQuery(
          this.masterConnectionName,
          `ALTER DATABASE [${this.databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${this.databaseName}]`,
        );
        await this.closeConnection(this.masterConnectionName);
        this.masterConnectionCreated = false;
      }
    } finally {
      this.client.dispose();
    }
  }

  private async createConnection(
    connectionName: string,
    database?: string,
  ): Promise<void> {
    const response = await this.client.sendRequest(
      "createConnection",
      LocalDbHelper.getLocalDbConnectionParams(
        connectionName,
        database ?? "master",
      ),
    );
    const payload = response as CreateConnectionPayload | null;
    if (payload?.$type !== "createConnection" || !payload?.success) {
      throw new Error(
        payload?.error?.message ?? "Bridge returned an invalid create response",
      );
    }
  }

  private async executeQuery(
    connectionName: string,
    query: string,
  ): Promise<void> {
    const response = await this.client.sendRequest("executeQuery", {
      connectionName,
      query,
      queryId: randomUUID(),
    });
    const payload = response as ExecuteQueryPayload | null;
    if (payload?.$type !== "executeQuery" || payload?.error) {
      throw new Error(
        payload?.error?.message ?? "Bridge returned an invalid query response",
      );
    }
  }

  private async closeConnection(connectionName: string): Promise<void> {
    const response = await this.client.sendRequest("closeConnection", {
      connectionName,
    });
    const payload = response as CloseConnectionPayload | null;
    if (payload?.$type !== "closeConnection" || !payload?.success) {
      throw new Error(
        payload?.error?.message ?? "Bridge returned an invalid close response",
      );
    }
  }
}
