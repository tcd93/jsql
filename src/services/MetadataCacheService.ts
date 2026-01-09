import * as vscode from "vscode";
import { SchemaData, ConnectionProfile, SmartDrillTableRequest } from "../types";

export class MetadataCacheService extends vscode.Disposable {
  private readonly schemaData: Map<string, SchemaData> = new Map();

  constructor() {
    super(() => this.dispose());
  }

  public dispose(): void {
    this.schemaData.clear();
  }

  public updateCache(schemaData: SchemaData, profile: ConnectionProfile): void {
    if (!schemaData || !profile?.name) {
      return;
    }

    const profileName = profile.name;
    const profileObj = schemaData[profileName];
    if (!profileObj) {
      return;
    }

    this.schemaData.set(profileName, schemaData);
  }

  public hasCache(profile: ConnectionProfile): boolean {
    if (!profile?.name) {
      return false;
    }
    const schemaData = this.schemaData.get(profile.name);
    return (
      schemaData !== undefined &&
      Object.keys(schemaData[profile.name] ?? {}).length > 0
    );
  }

  public findMatchingTables(
    columnNames: string[],
    profile: ConnectionProfile
  ): SmartDrillTableRequest[] {
    const result: SmartDrillTableRequest[] = [];
    if (!profile?.name) {
      return result;
    }

    const schemaData = this.schemaData.get(profile.name);
    if (!schemaData) {
      return result;
    }

    const profileObj = schemaData[profile.name];
    if (!profileObj) {
      return result;
    }

    const normalizedCols = columnNames.map((c) => String(c));

    // Extract table metadata on-demand from schemaData
    // schemaData structure: profileName -> catalog -> { children: { schemaName: { children: { tableName: { children: [columns] } } } } }
    Object.entries(profileObj).forEach(([catalogName, catalogObj]) => {
      const children =
        (catalogObj as { children?: Record<string, unknown> }).children ?? {};
      Object.entries(children).forEach(([schemaName, schemaObj]) => {
        const tables =
          (schemaObj as { children?: Record<string, unknown> }).children ?? {};
        Object.entries(tables).forEach(([tableName, tableObj]) => {
          const columnsArray: { label?: string }[] =
            (tableObj as { children?: { label?: string }[] }).children ?? [];

          // Count matching columns
          let matches = 0;
          for (const col of normalizedCols) {
            if (columnsArray.some((c) => c.label === col)) {
              matches++;
            }
          }

          // Only include tables that have ALL requested columns
          if (matches === normalizedCols.length) {
            result.push({
              tableCatalog: catalogName,
              tableSchema: schemaName,
              tableName,
              matchingColumns: matches,
            });
          }
        });
      });
    });

    // sort by matching columns desc
    result.sort((a, b) => b.matchingColumns - a.matchingColumns);

    return result;
  }

  /**
   * Get the full schema data for a profile (used by completion provider)
   */
  public getSchemaData(profile: ConnectionProfile): SchemaData | null {
    if (!profile?.name) {
      return null;
    }
    return this.schemaData.get(profile.name) ?? null;
  }

  /**
   * Clear schema data for a specific profile
   */
  public clearSchemaData(profile: ConnectionProfile): void {
    if (!profile?.name) {
      return;
    }
    this.schemaData.delete(profile.name);
  }
}
