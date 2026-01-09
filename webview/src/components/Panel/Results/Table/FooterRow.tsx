import { Table } from "@tanstack/react-table";
import React, { useCallback } from "react";
import { useSmartDrillStore } from "../../../../store/smartDrillStore";
import { formatNumber } from "../../../../utils/formatUtils";
import styles from "./FooterRow.module.css";

interface FooterRowProps {
  table: Table<unknown[]>;
}

export const FooterRow: React.FC<FooterRowProps> = ({ table }) => {
  const clearSelection = useSmartDrillStore((state) => state.clearSelection);

  const handleFooterCellClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const headers = table.getFlatHeaders();

  const values = headers.map((header) => {
    const aggregationFn = header.column.getAggregationFn();
    if (aggregationFn) {
      return aggregationFn(
        header.column.id,
        header.getContext().table.getRowModel().flatRows,
        header.getContext().table.getRowModel().rows
      );
    }
    return "";
  });

  return (
    <tr className={styles.footerRow}>
      {headers.map((header, index) => {
        const value = values[index];
        const columnType = header.column.columnDef.meta?.["type"];
        const displayValue =
          typeof value === "number" && columnType
            ? formatNumber(value, columnType)
            : value === 0 && header.id === "__row_number__"
            ? "0"
            : value === ""
            ? ""
            : String(value);

        return (
          <td
            key={header.id}
            className={styles.footerCell}
            style={{
              width: `calc(var(--col-${header.id}-size) * 1px)`,
            }}
            onClick={handleFooterCellClick}
          >
            {displayValue}
          </td>
        );
      })}
    </tr>
  );
};
