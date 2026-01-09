/**
 * Utility functions for formatting cell values and numbers based on data types
 */

/**
 * Checks if a data type is numeric
 */
export const isNumericType = (dataType?: string): boolean => {
  if (!dataType) {
    return false;
  }
  const normalizedType = dataType.toLowerCase();
  return (
    normalizedType === "int" ||
    normalizedType === "integer" ||
    normalizedType === "bigint" ||
    normalizedType === "tinyint" ||
    normalizedType === "smallint" ||
    normalizedType === "decimal" ||
    normalizedType === "numeric" ||
    normalizedType === "money" ||
    normalizedType === "smallmoney" ||
    normalizedType === "float" ||
    normalizedType === "real" ||
    normalizedType === "double"
  );
};

/**
 * Formats a number value based on its data type
 * Used for consistent number formatting across the application
 */
export const formatNumber = (value: number, dataType?: string): string => {
  if (!dataType) {
    return value.toLocaleString("en-US");
  }

  const normalizedType = dataType.toLowerCase();

  switch (normalizedType) {
    // Integer types
    case "int":
    case "integer":
    case "bigint":
    case "tinyint":
    case "smallint":
      return String(value);

    // Decimal/Numeric types (2 decimal places)
    case "decimal":
    case "numeric":
    case "money":
    case "smallmoney":
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    // Floating point types (4 decimal places)
    case "float":
    case "real":
    case "double":
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      });

    default:
      return value.toLocaleString("en-US");
  }
};

export const formatCell = (
  value: unknown,
  dataType?: string
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && value !== null) {
    return null;
  }

  if (!dataType) {
    return String(value);
  }

  const normalizedType = dataType.toLowerCase();
  const stringValue = String(value);

  switch (normalizedType) {
    // Numeric types (integer, decimal, and floating point)
    case "int":
    case "integer":
    case "bigint":
    case "tinyint":
    case "smallint":
    case "decimal":
    case "numeric":
    case "money":
    case "smallmoney":
    case "float":
    case "real":
    case "double":
      return formatNumber(Number(value), dataType);

    // Date types
    case "date":
      try {
        const date = new Date(stringValue);
        // Always return just the date part, even if SQL Server returns datetime
        return date.toISOString().split("T")[0]; // yyyy-mm-dd format
      } catch {
        // If it's already in yyyy-mm-dd format, return as-is
        if (stringValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return stringValue;
        }
        return stringValue;
      }

    // DateTime types
    case "datetime":
    case "datetime2":
    case "smalldatetime":
    case "timestamp":
      try {
        const date = new Date(stringValue);
        return date
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d{3}Z$/, ""); // yyyy-mm-dd hh:mm:ss format
      } catch {
        return stringValue;
      }

    // Time type
    case "time":
      try {
        // Handle time format (HH:mm:ss)
        if (stringValue.match(/^\d{2}:\d{2}:\d{2}/)) {
          return stringValue;
        }
        const date = new Date(stringValue);
        return date.toLocaleTimeString("en-US");
      } catch {
        return stringValue;
      }

    // Boolean type
    case "bit":
      return value === true ||
        value === 1 ||
        stringValue.toLowerCase() === "true"
        ? "true"
        : "false";

    // String and other types
    default:
      return stringValue;
  }
};
