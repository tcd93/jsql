export interface ISchemaQueryBuilder {
  buildTestConnectionQuery(): string;
  buildGetAllColumnsQuery(): string;
}
