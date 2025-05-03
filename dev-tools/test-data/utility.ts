import { getIsoDate } from '../../common/src/date-helper';
import { ColumnNames, TableRecordHelper } from './types';

/**
 * Throws a new error with the provided message if condition evaluates to false.
 * @param {boolean} condition results of some evaluation
 * @param {string} [message='Assertion failed.'] a message to use in a thrown Error
 */
export function assert(condition: boolean, message: string = 'Assertion failed.') {
  if (!condition) {
    throw new Error(message);
  }
}

const COMMA_SEPARATOR = ', ';

export function concatenateCityStateZipCountry(
  props: { city?: string; country?: string; state?: string; zip?: string } = {},
) {
  return removeExtraSpaces([props.city, props.state, props.zip, props.country].join(' '));
}

export function concatenateName(
  props: { firstName?: string; generation?: string; lastName?: string; middleName?: string } = {},
) {
  return removeExtraSpaces(
    [props.firstName, props.middleName, props.lastName, props.generation].join(' '),
  );
}

export function randomInt(range: number) {
  return Math.floor(Math.random() * range);
}

export function randomTruth() {
  return randomInt(2) > 0;
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

export function someDateAfterThisDate(thisDateString: string, days?: number): string {
  const thisDate = new Date(Date.parse(thisDateString));
  const daysToAdd = days || randomInt(1000);
  const someDate = new Date(thisDate.setDate(thisDate.getDate() + daysToAdd));
  return getIsoDate(someDate);
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
  const predicateColumnIndexes = predicateColumns.reduce((accumulator, value) => {
    const idx = columnNames.findIndex((element) => element === value);
    if (idx >= 0) accumulator.push(idx);
    return accumulator;
  }, [] as number[]);
  const assignments = record
    .reduce((accumulator, value, idx) => {
      if (predicateColumnIndexes.includes(idx)) return accumulator;
      if (omitColumnsNames.findIndex((element) => element === columnNames[idx]) !== -1)
        return accumulator;
      accumulator.push(`${columnNames[idx]}=${sqlEscapeValue(value)}`);
      return accumulator;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlEscape(record: Array<any>) {
  return record.map((column) => {
    return sqlEscapeValue(column);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlEscapeValue(value: any): string {
  if (typeof value === 'string') return `'${value.replace("'", "''")}'`;
  if (typeof value === 'number') return `${value}`;
  if (!value) return 'NULL';
  console.log('No case for: value', value, 'typeof', typeof value);
  return value;
}
