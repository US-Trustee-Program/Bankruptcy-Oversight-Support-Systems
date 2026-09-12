import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function escapeCsvField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped;
}

export async function writeCsv<T extends Record<string, string | number>>(
  rows: T[],
  filePath: string,
  columns?: Array<keyof T & string>,
): Promise<void> {
  const cols =
    columns ?? (rows.length > 0 ? (Object.keys(rows[0]) as Array<keyof T & string>) : []);
  if (cols.length === 0) {
    throw new Error(
      'writeCsv: cannot determine columns for an empty rows array without an explicit columns argument',
    );
  }
  const header = cols.map((col) => escapeCsvField(col)).join(',');
  const csvRows = rows.map((row) => cols.map((col) => escapeCsvField(String(row[col]))).join(','));
  const csv = [header, ...csvRows].join('\n') + '\n';

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, csv, 'utf8');
}
