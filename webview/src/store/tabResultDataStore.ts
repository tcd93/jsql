import { Observable, Subject } from "rxjs";

export interface TabResultDataSource {
  readonly dataStream: Observable<unknown[][]>;
  getRows(): unknown[][];
}

class TabResultData implements TabResultDataSource {
  private rows: unknown[][] = [];
  private readonly subject = new Subject<unknown[][]>();
  readonly dataStream = this.subject.asObservable();

  append(rows: unknown[][]): void {
    for (const row of rows) {
      this.rows.push(row);
    }
    this.subject.next(rows);
  }

  getRows(): unknown[][] {
    return this.rows;
  }

  dispose(): void {
    this.subject.complete();
    this.rows = [];
  }
}

const tabResultData = new Map<string, TabResultData>();

export const createTabResultData = (tabId: string): void => {
  tabResultData.set(tabId, new TabResultData());
};

export const appendTabResultData = (tabId: string, rows: unknown[][]): void => {
  const resultData = tabResultData.get(tabId);
  if (!resultData) {
    console.error(`No result data store found for tab ${tabId}`);
    return;
  }

  resultData.append(rows);
};

export const getTabResultData = (tabId: string): TabResultData | undefined =>
  tabResultData.get(tabId);

export const getTabResultRows = (tabId: string): unknown[][] =>
  tabResultData.get(tabId)?.getRows() ?? [];

export const deleteTabResultData = (tabId: string): void => {
  const resultData = tabResultData.get(tabId);
  if (resultData) {
    resultData.dispose();
    tabResultData.delete(tabId);
  }
};
