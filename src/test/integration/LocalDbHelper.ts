import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class LocalDbHelper {
  static getLocalDbConnectionString(database?: string): string {
    const parts: string[] = [
      "Data Source=(localdb)\\MSSQLLocalDB",
      "Integrated Security=true",
      "TrustServerCertificate=true",
      "Encrypt=false",
    ];

    if (database) {
      parts.push(`Initial Catalog=${database}`);
    }

    return parts.join(";");
  }

  static async isLocalDbAvailable(): Promise<boolean> {
    try {
      await execAsync(
        `sqlcmd -S "(localdb)\\MSSQLLocalDB" -Q "SELECT 1" -E`
      );
      return true;
    } catch {
      return false;
    }
  }

  static async ensureTestDatabase(
    databaseName = "SqlServerBridgeTest"
  ): Promise<void> {
    const checkDbQuery = `
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${databaseName}')
      BEGIN
        CREATE DATABASE [${databaseName}]
      END`;

    try {
      await execAsync(
        `sqlcmd -S "(localdb)\\MSSQLLocalDB" -Q "${checkDbQuery.replace(/\n/g, " ").trim()}" -E`
      );
    } catch (error) {
      throw new Error(
        `Failed to create test database: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  static async createTestTable(
    connectionString: string,
    tableName = "TestTable"
  ): Promise<void> {
    const database = this.extractDatabaseFromConnectionString(connectionString);
    const server = "(localdb)\\MSSQLLocalDB";

    const dropTableQuery = `
      IF OBJECT_ID('${tableName}', 'U') IS NOT NULL
        DROP TABLE [${tableName}]`;

    const createTableQuery = `
      CREATE TABLE [${tableName}] (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(100) NOT NULL,
        Value INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      )`;

    const insertDataQuery = `
      INSERT INTO [${tableName}] (Name, Value) VALUES
        ('Item1', 10),
        ('Item2', 20),
        ('Item3', 30)`;

    try {
      const dbOption = database ? `-d ${database}` : "";
      await execAsync(
        `sqlcmd -S "${server}" ${dbOption} -Q "${dropTableQuery.replace(/\n/g, " ").trim()}" -E`
      );
      await execAsync(
        `sqlcmd -S "${server}" ${dbOption} -Q "${createTableQuery.replace(/\n/g, " ").trim()}" -E`
      );
      await execAsync(
        `sqlcmd -S "${server}" ${dbOption} -Q "${insertDataQuery.replace(/\n/g, " ").trim()}" -E`
      );
    } catch (error) {
      throw new Error(
        `Failed to create test table: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  static async cleanupTestDatabase(
    databaseName = "SqlServerBridgeTest"
  ): Promise<void> {
    const dropDbQuery = `
      IF EXISTS (SELECT name FROM sys.databases WHERE name = '${databaseName}')
      BEGIN
        ALTER DATABASE [${databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE
        DROP DATABASE [${databaseName}]
      END`;

    try {
      await execAsync(
        `sqlcmd -S "(localdb)\\MSSQLLocalDB" -Q "${dropDbQuery.replace(/\n/g, " ").trim()}" -E`
      );
    } catch {
      // Ignore cleanup errors
    }
  }

  private static extractDatabaseFromConnectionString(
    connectionString: string
  ): string | undefined {
    const match = connectionString.match(/Initial Catalog=([^;]+)/i);
    return match ? match[1] : undefined;
  }
}
