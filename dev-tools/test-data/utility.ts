import { ColumnNames, TableRecordHelper } from './types';

/**
 * Quick and dirty assert function.
 * @param condition results of some evaluation
 * @param message a message to use in a thrown Error
 */
export function assert(condition: boolean, message: string = 'Assertion failed.') {
  if (!condition) {
    throw new Error(message);
  }
}

const COMMA_SEPARATOR = ', ';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlEscapeValue(value: any): string {
  if (typeof value === 'string') return `'${value.replace("'", "''")}'`;
  if (typeof value === 'number') return `${value}`;
  if (!value) return 'NULL';
  console.log('No case for: value', value, 'typeof', typeof value);
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlEscape(record: Array<any>) {
  return record.map((column) => {
    return sqlEscapeValue(column);
  });
}

export function toSqlInsertStatement(
  tableName: string,
  columnNames: ColumnNames,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Array<any>,
): string {
  return `
  INSERT INTO ${tableName} (${columnNames.join(COMMA_SEPARATOR)})
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

export function toSqlUpdateStatement(
  tableName: string,
  columnNames: ColumnNames,
  predicateColumns: string[],
  omitColumnsNames: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Array<any>,
): string {
  const predicateColumnIndexes = predicateColumns.reduce((acc, value) => {
    const idx = columnNames.findIndex((element) => element === value);
    if (idx >= 0) acc.push(idx);
    return acc;
  }, [] as number[]);
  const assignments = record
    .reduce((acc, value, idx) => {
      if (predicateColumnIndexes.includes(idx)) return acc;
      if (omitColumnsNames.findIndex((element) => element === columnNames[idx]) !== -1) return acc;
      acc.push(`${columnNames[idx]}=${sqlEscapeValue(value)}`);
      return acc;
    }, [])
    .join(', ');
  const predicate = predicateColumns
    .map((columnName, idx) => {
      const position = columnNames.findIndex((element) => element === columnName);
      return `${predicateColumns[idx]}=${sqlEscapeValue(record[position])}`;
    })
    .join(' AND ');
  return `UPDATE ${tableName} SET ${assignments} WHERE ${predicate}`;
}

export function toSqlUpdateStatements(
  tableName: string,
  columnNames: ColumnNames,
  predicateColumns: string[],
  omitColumnsNames: string[],
  records: Array<TableRecordHelper>,
): string[] {
  return records.map((record) => {
    return toSqlUpdateStatement(
      tableName,
      columnNames,
      predicateColumns,
      omitColumnsNames,
      record.toInsertableArray(),
    );
  });
}

export function randomTruth() {
  return randomInt(2) > 0;
}

export function randomInt(range: number) {
  return Math.floor(Math.random() * range);
}

export function removeExtraSpaces(s: string | undefined): string | undefined {
  if (s) {
    return s
      .trim()
      .split(/[\s,\t,\n]+/g)
      .join(' ');
  }

  return undefined;
}

export function concatenateName(
  props: { firstName?: string; lastName?: string; middleName?: string; generation?: string } = {},
) {
  return removeExtraSpaces(
    [props.firstName, props.middleName, props.lastName, props.generation].join(' '),
  );
}

export function concatenateCityStateZipCountry(
  props: { city?: string; state?: string; zip?: string; country?: string } = {},
) {
  return removeExtraSpaces([props.city, props.state, props.zip, props.country].join(' '));
}

export function someDateAfterThisDate(thisDateString: string, days?: number): string {
  const thisDate = new Date(Date.parse(thisDateString));
  const daysToAdd = days || randomInt(1000);
  const someDate = new Date(thisDate.setDate(thisDate.getDate() + daysToAdd));
  return someDate.toISOString().split('T')[0];
}
