import { readFile } from 'node:fs/promises';

export type CsvRow = Record<string, string>;

// For the by-period CSVs written by writeCsv: dates and numbers only, so no quoted fields.
export function parseCsv(text: string, columns: readonly string[], source: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line !== '');
  const header = lines[0] ?? '';
  const expectedHeader = columns.join(',');
  if (header !== expectedHeader) {
    throw new Error(`${source}: expected header "${expectedHeader}" but found "${header}"`);
  }

  return lines.slice(1).map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== columns.length) {
      throw new Error(
        `${source} line ${index + 2}: expected ${columns.length} fields but found ${fields.length}`,
      );
    }
    return Object.fromEntries(columns.map((column, i) => [column, fields[i]]));
  });
}

export async function readCsv(filePath: string, columns: readonly string[]): Promise<CsvRow[]> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Missing CSV file: ${filePath}`);
    }
    throw error;
  }
  return parseCsv(text, columns, filePath);
}
