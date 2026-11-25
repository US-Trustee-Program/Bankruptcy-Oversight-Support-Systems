import { readFile } from 'node:fs/promises';

export type CsvRow = Record<string, string>;

// For the by-period CSVs written by writeCsv: dates and numbers only, so no quoted fields.
// olderColumns is the header a file written before the current columns would have; its rows are keyed
// by those older columns.
export function parseCsv(
  text: string,
  currentColumns: readonly string[],
  source: string,
  olderColumns?: readonly string[],
): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line !== '');
  const header = lines[0] ?? '';
  const expectedHeader = currentColumns.join(',');
  const columns = olderColumns && header === olderColumns.join(',') ? olderColumns : currentColumns;
  if (header !== columns.join(',')) {
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

export async function readCsv(
  filePath: string,
  columns: readonly string[],
  olderColumns?: readonly string[],
): Promise<CsvRow[]> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Missing CSV file: ${filePath}`);
    }
    throw error;
  }
  return parseCsv(text, columns, filePath, olderColumns);
}
