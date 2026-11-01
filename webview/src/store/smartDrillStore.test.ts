import { Cell, Table } from "@tanstack/react-table";
import { beforeEach, describe, expect, it } from "vitest";
import { useSmartDrillStore } from "./smartDrillStore";

const rowNumberColumnId = "__row_number__";

interface TestCell {
  id: string;
  row: {
    id: string;
    getAllCells: () => TestCell[];
  };
  column: { id: string };
}

interface TableFixture {
  table: Table<unknown[]>;
  cells: Map<string, Cell<unknown[], unknown>>;
}

const createTable = (
  columnIds = [rowNumberColumnId, "first", "second"],
  pinnedColumnIds: string[] = [],
): TableFixture => {
  const columns = columnIds.map((id) => ({ id }));
  const pinnedColumns = pinnedColumnIds
    .map((id) => columns.find((column) => column.id === id))
    .filter((column) => column !== undefined);
  const orderedColumns = [
    ...pinnedColumns,
    ...columns.filter((column) => !pinnedColumnIds.includes(column.id)),
  ];
  const cells = new Map<string, Cell<unknown[], unknown>>();
  const rows = ["row-0", "row-1"].map((rowId) => {
    let rowCells: TestCell[] = [];
    const row: TestCell["row"] = {
      id: rowId,
      getAllCells: (): TestCell[] => rowCells,
    };
    rowCells = columnIds.map((columnId): TestCell => {
      const cell: TestCell = {
        id: `${rowId}:${columnId}`,
        row,
        column: { id: columnId },
      };
      cells.set(cell.id, cell as unknown as Cell<unknown[], unknown>);
      return cell;
    });

    return row;
  });

  const table = {
    getVisibleLeafColumns: () => columns,
    getLeafHeaders: () => orderedColumns.map((column) => ({ column })),
    getRowModel: () => ({ rows }),
  } as unknown as Table<unknown[]>;

  return { table, cells };
};

const getCell = (
  cells: Map<string, Cell<unknown[], unknown>>,
  id: string,
): Cell<unknown[], unknown> => {
  const cell = cells.get(id);
  if (!cell) {
    throw new Error(`Test cell not found: ${id}`);
  }
  return cell;
};

describe("smartDrillStore keyboard navigation", () => {
  beforeEach(() => {
    useSmartDrillStore.getState().clearSelection();
  });

  it("does not allow selecting the row number column", () => {
    const { cells } = createTable();

    useSmartDrillStore
      .getState()
      .selectCell(getCell(cells, `row-0:${rowNumberColumnId}`));

    expect(useSmartDrillStore.getState().anchorCell).toBeNull();
    expect(useSmartDrillStore.getState().selectedCells.size).toBe(0);
  });

  it("stops horizontal navigation at the first data column", () => {
    const { table, cells } = createTable();
    const firstCell = getCell(cells, "row-0:first");

    useSmartDrillStore.getState().selectCell(firstCell);
    const movedCell = useSmartDrillStore
      .getState()
      .navigateCell("left", table);

    expect(movedCell).toBeNull();
    expect(useSmartDrillStore.getState().anchorCell).toBe(firstCell);
    expect(
      [...useSmartDrillStore.getState().selectedCells.values()].map(
        (cell) => cell.column.id,
      ),
    ).toEqual(["first"]);
  });

  it("navigates through pinned columns in their displayed order", () => {
    const { table, cells } = createTable(
      [
        rowNumberColumnId,
        "employee_id",
        "full_name",
        "email_address",
        "department",
        "salary",
      ],
      ["department"],
    );
    const store = useSmartDrillStore.getState();

    store.selectCell(getCell(cells, "row-0:email_address"));
    expect(store.navigateCell("right", table)?.column.id).toBe("salary");

    useSmartDrillStore
      .getState()
      .selectCell(getCell(cells, "row-0:employee_id"));
    expect(
      useSmartDrillStore.getState().navigateCell("left", table)?.column.id,
    ).toBe("department");

    expect(
      useSmartDrillStore.getState().navigateCell("right", table)?.column.id,
    ).toBe("employee_id");
  });

  it("does not include the row number column in extended selections", () => {
    const { table, cells } = createTable();
    const firstCell = getCell(cells, "row-0:first");
    const secondCell = getCell(cells, "row-0:second");
    const store = useSmartDrillStore.getState();

    store.selectCell(firstCell);
    store.selectRectangleWithDirection("left", table);
    expect([...useSmartDrillStore.getState().selectedCells.values()]).toEqual([
      firstCell,
    ]);

    useSmartDrillStore.getState().selectRectangleWithDirection("right", table);
    expect(
      [...useSmartDrillStore.getState().selectedCells.values()],
    ).toEqual([firstCell, secondCell]);
  });
});
