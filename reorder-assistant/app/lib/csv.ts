export type CsvValue = string | number | null | undefined;

/**
 * Builds an RFC 4180 CSV string. Cells that a spreadsheet would treat as a
 * formula are prefixed with a quote, since these files get opened in Excel
 * by suppliers.
 */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

function cell(value: CsvValue): string {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
