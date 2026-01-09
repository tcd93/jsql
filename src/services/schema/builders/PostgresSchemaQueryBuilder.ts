import { ISchemaQueryBuilder } from "../ISchemaQueryBuilder";

export class PostgresSchemaQueryBuilder implements ISchemaQueryBuilder {
  buildTestConnectionQuery(): string {
    return "SELECT 1 as test_connection";
  }

  buildGetAllColumnsQuery(): string {
    return `
            SELECT 
                table_catalog as TABLE_CATALOG,
                table_schema as TABLE_SCHEMA,
                table_name as TABLE_NAME,
                column_name as COLUMN_NAME,
                data_type as DATA_TYPE,
                is_nullable as IS_NULLABLE,
                ordinal_position as ORDINAL_POSITION,
                character_maximum_length as CHARACTER_MAXIMUM_LENGTH,
                numeric_precision as NUMERIC_PRECISION,
                numeric_scale as NUMERIC_SCALE
            FROM information_schema.columns
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY table_catalog, table_schema, table_name, ordinal_position
        `;
  }
}
