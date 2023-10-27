import { ColumnNames, TableRecordHelper } from './types';

/**
 * Quick and dirty assert function.
 * @param condition results of some evaluation
 * @param message a message to use in a thrown Error
 */
export function assert(condition: boolean, message: string = 'Assertion failed.') {
  if (!condition) throw new Error(message);
}

const COMMA_SEPARATOR = ', ';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlEscape(record: Array<any>) {
  return record.map((column) => {
    if (typeof column === 'string') return `'${column}'`;
    if (typeof column === 'number') return `${column}`;
    if (!column) return 'NULL';
    console.log('No case for: value', column, 'typeof', typeof column);
    return column;
  });
}

export function toSqlInsertStatement(
  tableName: string,
  columnNames: ColumnNames,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Array<any>,
): string {
  return `
  INSERT INTO ${tableName}(${columnNames.join(COMMA_SEPARATOR)})
  VALUES(${sqlEscape(record).join(COMMA_SEPARATOR)});
  `;
}

export function toSqlInsertStatements(
  tableName: string,
  columnNames: ColumnNames,
  records: Array<TableRecordHelper>,
): string[] {
  return records.map((record) => {
    return toSqlInsertStatement(tableName, columnNames, record.toInsertableArray());
  });
}
