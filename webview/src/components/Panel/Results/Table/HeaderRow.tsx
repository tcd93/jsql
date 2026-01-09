import { Table } from "@tanstack/react-table";
import { HeaderCell } from "../Cell/HeaderCell";

export const HeaderRow = ({
  table,
}: {
  table: Table<unknown[]>;
  tableRef?: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element => (
  <>
    {table.getHeaderGroups().map((headerGroup) => (
      <tr key={headerGroup.id}>
        {headerGroup.headers.map((header) => (
          <HeaderCell header={header} key={header.id} />
        ))}
      </tr>
    ))}
  </>
);
