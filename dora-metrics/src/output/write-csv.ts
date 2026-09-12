import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

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
  const header = cols.join(',');
  const csvRows = rows.map((row) => cols.map((col) => String(row[col])).join(','));
  const csv = [header, ...csvRows].join('\n') + '\n';

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, csv, 'utf8');
}
