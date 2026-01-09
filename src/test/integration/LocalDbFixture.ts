import { LocalDbHelper } from "./LocalDbHelper";

export class LocalDbFixture {
  public readonly databaseName = "SqlServerBridgeTest";

  async initialize(): Promise<void> {
    if (!(await LocalDbHelper.isLocalDbAvailable())) {
      throw new Error(
        "SQL Server LocalDB is not available. " +
          "Please install SQL Server Express LocalDB or SQL Server Developer Edition."
      );
    }

    await LocalDbHelper.ensureTestDatabase(this.databaseName);

    const connectionString =
      LocalDbHelper.getLocalDbConnectionString(this.databaseName);
    await LocalDbHelper.createTestTable(connectionString);
  }

  async dispose(): Promise<void> {
    await LocalDbHelper.cleanupTestDatabase(this.databaseName);
  }
}
