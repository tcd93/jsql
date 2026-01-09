import {
  ExecuteStreamingQuerySchemaMessage,
  ExecuteStreamingQueryDataMessage,
  ExecuteStreamingQueryCompleteMessage,
  WebviewMessage,
  ExecuteStreamingQueryMessage,
} from "@src/types";
import { VSCodeAPI } from "./vscode";

export const mockVscodeApi: VSCodeAPI = {
  postMessage: (message: WebviewMessage) => {
    console.log("Mock postMessage called", message);
    // Simulate a response from the VSCode API
    if (message.type === "wv.findMatchingTables") {
      const findTablesMessage = message as WebviewMessage & {
        payload: { uniqueColumnNames: string[] };
      };
      const uniqueColumnNames =
        findTablesMessage.payload?.uniqueColumnNames ?? [];

      // Simulate finding matching tables based on selected columns
      setTimeout(() => {
        const tablesResponse = {
          type: "ext.smartDrillTablesFound",
          payload: {
            tables: [
              {
                tableCatalog: "company_db",
                tableSchema: "hr",
                tableName: "employees",
                matchingColumns: uniqueColumnNames.length,
              },
              {
                tableCatalog: "company_db",
                tableSchema: "hr",
                tableName: "employee_history",
                matchingColumns: Math.max(1, uniqueColumnNames.length - 1),
              },
              {
                tableCatalog: "company_db",
                tableSchema: "finance",
                tableName: "payroll",
                matchingColumns: Math.max(1, uniqueColumnNames.length - 2),
              },
              {
                tableCatalog: "analytics_db",
                tableSchema: "reporting",
                tableName: "employee_metrics",
                matchingColumns: Math.max(1, uniqueColumnNames.length - 1),
              },
              {
                tableCatalog: "company_db",
                tableSchema: "hr",
                tableName: "department_assignments",
                matchingColumns: Math.max(1, uniqueColumnNames.length - 3),
              },
            ],
          },
        };
        window.dispatchEvent(
          new MessageEvent("message", { data: tablesResponse })
        );
      }, 800);
    } else if (message.type === "wv.getSchemaData") {
      // Simulate schema data response
      setTimeout(() => {
        const schemaDataResponse = {
          type: "ext.schemaDataFound",
          payload: {
            schemaData: {
              "Mock Dremio Connection": {
                company_db: {
                  self: {
                    label: "company_db",
                    detail: "catalog",
                    type: "catalog",
                  },
                  children: {
                    hr: {
                      self: {
                        label: "hr",
                        detail: "schema",
                        type: "schema",
                      },
                      children: {
                        employees: {
                          self: {
                            label: "employees",
                            detail: "table",
                            type: "table",
                          },
                          children: [
                            {
                              label: "employee_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "full_name",
                              detail: "VARCHAR(100)",
                              type: "column",
                            },
                            {
                              label: "email_address",
                              detail: "VARCHAR(255)",
                              type: "column",
                            },
                            {
                              label: "department",
                              detail: "VARCHAR(50)",
                              type: "column",
                            },
                            {
                              label: "job_title",
                              detail: "VARCHAR(100)",
                              type: "column",
                            },
                            {
                              label: "salary",
                              detail: "DECIMAL(10,2)",
                              type: "column",
                            },
                            {
                              label: "hire_date",
                              detail: "DATE",
                              type: "column",
                            },
                            {
                              label: "last_login",
                              detail: "TIMESTAMP",
                              type: "column",
                            },
                            {
                              label: "biography",
                              detail: "TEXT (nullable)",
                              type: "column",
                            },
                            {
                              label: "performance_score",
                              detail: "FLOAT",
                              type: "column",
                            },
                            {
                              label: "is_active",
                              detail: "BOOLEAN",
                              type: "column",
                            },
                            {
                              label: "manager_id",
                              detail: "BIGINT (nullable)",
                              type: "column",
                            },
                          ],
                        },
                        employee_history: {
                          self: {
                            label: "employee_history",
                            detail: "table",
                            type: "table",
                          },
                          children: [
                            {
                              label: "history_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "employee_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "action",
                              detail: "VARCHAR(50)",
                              type: "column",
                            },
                            {
                              label: "action_date",
                              detail: "TIMESTAMP",
                              type: "column",
                            },
                            {
                              label: "old_value",
                              detail: "TEXT (nullable)",
                              type: "column",
                            },
                            {
                              label: "new_value",
                              detail: "TEXT (nullable)",
                              type: "column",
                            },
                          ],
                        },
                        department_assignments: {
                          self: {
                            label: "department_assignments",
                            detail: "table",
                            type: "table",
                          },
                          children: [
                            {
                              label: "assignment_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "employee_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "department_code",
                              detail: "VARCHAR(10)",
                              type: "column",
                            },
                            {
                              label: "assignment_date",
                              detail: "DATE",
                              type: "column",
                            },
                            {
                              label: "end_date",
                              detail: "DATE (nullable)",
                              type: "column",
                            },
                          ],
                        },
                      },
                    },
                    finance: {
                      self: {
                        label: "finance",
                        detail: "schema",
                        type: "schema",
                      },
                      children: {
                        payroll: {
                          self: {
                            label: "payroll",
                            detail: "table",
                            type: "table",
                          },
                          children: [
                            {
                              label: "payroll_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "employee_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "pay_period_start",
                              detail: "DATE",
                              type: "column",
                            },
                            {
                              label: "pay_period_end",
                              detail: "DATE",
                              type: "column",
                            },
                            {
                              label: "gross_pay",
                              detail: "DECIMAL(10,2)",
                              type: "column",
                            },
                            {
                              label: "net_pay",
                              detail: "DECIMAL(10,2)",
                              type: "column",
                            },
                            {
                              label: "taxes_withheld",
                              detail: "DECIMAL(10,2)",
                              type: "column",
                            },
                          ],
                        },
                      },
                    },
                  },
                },
                analytics_db: {
                  self: {
                    label: "analytics_db",
                    detail: "catalog",
                    type: "catalog",
                  },
                  children: {
                    reporting: {
                      self: {
                        label: "reporting",
                        detail: "schema",
                        type: "schema",
                      },
                      children: {
                        employee_metrics: {
                          self: {
                            label: "employee_metrics",
                            detail: "table",
                            type: "table",
                          },
                          children: [
                            {
                              label: "metric_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "employee_id",
                              detail: "BIGINT",
                              type: "column",
                            },
                            {
                              label: "metric_date",
                              detail: "DATE",
                              type: "column",
                            },
                            {
                              label: "productivity_score",
                              detail: "FLOAT",
                              type: "column",
                            },
                            {
                              label: "satisfaction_rating",
                              detail: "INTEGER",
                              type: "column",
                            },
                            {
                              label: "hours_worked",
                              detail: "DECIMAL(5,2)",
                              type: "column",
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        };
        window.dispatchEvent(
          new MessageEvent("message", { data: schemaDataResponse })
        );
      }, 1200);
    } else if (message.type === "wv.generateSmartDrillQuery") {
      const generateQueryMessage = message as WebviewMessage & {
        payload: {
          selectedTable: {
            tableCatalog: string;
            tableSchema: string;
            tableName: string;
            matchingColumns: number;
          };
          selectedCells: {
            rowId: string;
            columnId: string;
            value: unknown;
          }[];
        };
      };
      const selectedTable = generateQueryMessage.payload?.selectedTable;
      const selectedCells = generateQueryMessage.payload?.selectedCells ?? [];
      let generatedQuery = `SELECT * FROM "${selectedTable?.tableSchema}"."${selectedTable?.tableName}"`;

      // Simulate generating a smart drill query
      setTimeout(() => {
        if (selectedCells.length > 0) {
          const conditions: string[] = [];

          // Group cells by column
          const columnGroups = new Map<string, unknown[]>();
          selectedCells.forEach((cell) => {
            if (!columnGroups.has(cell.columnId)) {
              columnGroups.set(cell.columnId, []);
            }
            columnGroups.get(cell.columnId)?.push(cell.value);
          });

          // Generate WHERE conditions
          columnGroups.forEach((values, columnId) => {
            const uniqueValues = [...new Set(values)];
            if (uniqueValues.length === 1) {
              const value = uniqueValues[0];
              if (value === null || value === undefined) {
                conditions.push(`"${columnId}" IS NULL`);
              } else if (typeof value === "string") {
                conditions.push(
                  `"${columnId}" = '${value.replace(/'/g, "''")}'`
                );
              } else {
                conditions.push(`"${columnId}" = ${value}`);
              }
            } else {
              const formattedValues = uniqueValues.map((v) => {
                if (v === null || v === undefined) {
                  return "NULL";
                }
                if (typeof v === "string") {
                  return `'${v.replace(/'/g, "''")}'`;
                }
                return String(v);
              });
              conditions.push(
                `"${columnId}" IN (${formattedValues.join(", ")})`
              );
            }
          });

          if (conditions.length > 0) {
            generatedQuery += ` WHERE ${conditions.join(" AND ")}`;
          }
        }

        generatedQuery += ";";

        const queryResponse = {
          type: "ext.smartDrillQueryGenerated",
          payload: {
            query: generatedQuery,
          },
        };
        window.dispatchEvent(
          new MessageEvent("message", { data: queryResponse })
        );
      }, 600);
    } else if (message.type === "wv.executeStreamingQuery") {
      const executeMessage = message as ExecuteStreamingQueryMessage;
      const queryId = executeMessage.payload?.queryId ?? "mock-query-id";
      const tabId = crypto.randomUUID();
      const generatedQuery = `SELECT * FROM mock`;

      // Simulate schema message with more complex columns
      setTimeout(() => {
        const schemaResponse: ExecuteStreamingQuerySchemaMessage = {
          type: "ext.streamingQuerySchema",
          payload: {
            queryId,
            query: generatedQuery,
            tabId,
            schema: [
              { name: "employee_id", type: "BIGINT" },
              { name: "full_name", type: "VARCHAR" },
              { name: "email_address", type: "VARCHAR" },
              { name: "department", type: "VARCHAR" },
              { name: "job_title", type: "VARCHAR" },
              { name: "salary", type: "DECIMAL" },
              { name: "hire_date", type: "DATE" },
              { name: "last_login", type: "TIMESTAMP" },
              { name: "biography", type: "TEXT" },
              { name: "performance_score", type: "FLOAT" },
              { name: "is_active", type: "BOOLEAN" },
              { name: "manager_id", type: "BIGINT" },
            ],
          },
        };
        window.dispatchEvent(
          new MessageEvent("message", { data: schemaResponse })
        );
      }, 1000);

      // Simulate data messages with dynamic generation (many rows)
      const TOTAL_ROWS = 5005;
      const BATCH_SIZE = 50;
      let currentRow = 0;
      let currentBatch = 0;

      const generateRow = (id: number): unknown[] => {
        return [
          id,
          `Employee Name ${id}`,
          `employee${id}@company.com`,
          `Department ${id % 10}`,
          `Job Title ${id % 5}`,
          50000 + id * 10,
          new Date(2020, 0, 1).toISOString().split("T")[0], // DATE
          new Date().toISOString(), // TIMESTAMP
          `Biography for employee ${id}. This is a long text field to simulate large content. `.repeat(
            Math.ceil(Math.random() * 5)
          ),
          Number((Math.random() * 5).toFixed(2)),
          id % 2 === 0,
          id > 10 ? id - 10 : null,
        ];
      };

      const sendNextBatch = (): void => {
        if (currentRow >= TOTAL_ROWS) {
          // Send completion
          const completeResponse: ExecuteStreamingQueryCompleteMessage = {
            type: "ext.streamingQueryComplete",
            payload: {
              query: generatedQuery,
              queryId,
              tabId,
              summary: {
                totalRows: currentRow,
                totalBatches: currentBatch,
              },
            },
          };
          window.dispatchEvent(
            new MessageEvent("message", { data: completeResponse })
          );
          return;
        }

        currentBatch++;
        const rows: unknown[][] = [];
        const batchLimit = Math.min(BATCH_SIZE, TOTAL_ROWS - currentRow);

        for (let i = 0; i < batchLimit; i++) {
          currentRow++;
          rows.push(generateRow(currentRow));
        }

        const dataResponse: ExecuteStreamingQueryDataMessage = {
          type: "ext.streamingQueryData",
          payload: {
            queryId,
            tabId,
            data: {
              rows,
              batchNumber: currentBatch,
              totalRowsSoFar: currentRow,
            },
          },
        };

        window.dispatchEvent(
          new MessageEvent("message", { data: dataResponse })
        );

        // Schedule next batch
        setTimeout(sendNextBatch, 50);
      };

      // Start sending data after schema
      setTimeout(sendNextBatch, 1200);
    }
  },
  getState: () => null,
  setState: (_state: unknown) => {
    // Mock implementation - no-op
  },
};
