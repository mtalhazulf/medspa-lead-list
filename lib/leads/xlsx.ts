import { readSheet } from "read-excel-file/universal";

import { parseLeadTable, type CsvParseResult } from "@/lib/leads/csv";

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function parseLeadXlsx(buffer: ArrayBuffer, filename: string): Promise<CsvParseResult> {
  try {
    const rows = await readSheet(buffer);
    const table = rows.map((row) => row.map(cellToString));
    return parseLeadTable(table, filename);
  } catch {
    return { ok: false, message: "Could not read this Excel file. Try exporting it as .xlsx or CSV." };
  }
}
