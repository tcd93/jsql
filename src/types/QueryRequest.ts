export interface QueryRequest {
  query: string;
  queryId: string;
}

export interface FindTablesRequest {
  uniqueColumnNames: string[];
}

// Request to find tables that contain all the selected columns
export interface SmartDrillTableRequest {
  tableCatalog: string;
  tableSchema: string;
  tableName: string;
  matchingColumns: number;
}

export interface SmartDrillCellSelection {
  rowId: string;
  columnId: string;
  columnName: string;
  value: unknown;
  type: string;
}
