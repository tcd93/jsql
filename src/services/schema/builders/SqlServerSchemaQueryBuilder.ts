import { ISchemaQueryBuilder } from "../ISchemaQueryBuilder";

export class SqlServerSchemaQueryBuilder implements ISchemaQueryBuilder {
  buildTestConnectionQuery(): string {
    return "SELECT 1 as test_connection";
  }

  buildGetAllColumnsQuery(): string {
    return `
      -- Create a table to hold the results
      CREATE TABLE #Columns (
          TABLE_CATALOG sysname,
          TABLE_SCHEMA sysname,
          TABLE_NAME sysname,
          COLUMN_NAME sysname,
          DATA_TYPE sysname,
          IS_NULLABLE varchar(3),
          ORDINAL_POSITION int,
          CHARACTER_MAXIMUM_LENGTH int,
          NUMERIC_PRECISION tinyint,
          NUMERIC_SCALE int
      );

      DECLARE @db sysname;
      DECLARE @sql NVARCHAR(MAX);

      DECLARE db_cursor CURSOR FAST_FORWARD FOR
      SELECT name
      FROM sys.databases
      WHERE state = 0
        AND name NOT IN ('master', 'model', 'msdb', 'tempdb')
        AND HAS_DBACCESS(name) = 1;

      OPEN db_cursor;
      FETCH NEXT FROM db_cursor INTO @db;

      WHILE @@FETCH_STATUS = 0
      BEGIN
          SET @sql = N'
              INSERT INTO #Columns
              SELECT 
                  ''' + @db + ''' AS TABLE_CATALOG,
                  TABLE_SCHEMA,
                  TABLE_NAME,
                  COLUMN_NAME,
                  DATA_TYPE,
                  IS_NULLABLE,
                  ORDINAL_POSITION,
                  CHARACTER_MAXIMUM_LENGTH,
                  NUMERIC_PRECISION,
                  NUMERIC_SCALE
              FROM [' + @db + '].INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA NOT IN (''information_schema'', ''sys'')
          ';
          
          EXEC sp_executesql @sql;

          FETCH NEXT FROM db_cursor INTO @db;
      END

      CLOSE db_cursor;
      DEALLOCATE db_cursor;

      -- Final ordered result
      SELECT *
      FROM #Columns
      ORDER BY TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;

      DROP TABLE #Columns;
    `;
  }
}
