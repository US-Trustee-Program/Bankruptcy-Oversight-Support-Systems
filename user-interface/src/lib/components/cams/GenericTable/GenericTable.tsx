import Table, {
  TableBody,
  TableHeader,
  TableHeaderData,
  TableProps,
  TableRow,
  TableRowData,
} from '../../uswds/Table';

import type { JSX } from 'react';

const defaultTransformer = (v: unknown) => v?.toString() ?? '';

type ColumnInfo<T> = {
  name: string;
  content: React.ReactNode;
  mobileTitle: string;
  property: keyof T | '@';
  transformer?: GenericTableTransformer;
};

type GenericTableColumns<T> = ColumnInfo<T>[];

// TODO: Figure out how to get the correct type for the value parameter.
// type GenericTableTransformer<T> = (arg: T[keyof T] | T, idx?: number) => React.ReactNode;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericTableTransformer = (arg: any, idx?: number) => React.ReactNode;

export type GenericTableProps<T> = {
  columns: GenericTableColumns<T>;
  data: T[];
};

type GenericTablePropsAll<T> = JSX.IntrinsicElements['table'] &
  Pick<TableProps, 'id' | 'uswdsStyle' | 'scrollable' | 'caption'> &
  GenericTableProps<T>;

export function GenericTable<T>(props: GenericTablePropsAll<T>) {
  const { id, data, columns, ...otherProps } = props;
  return (
    <Table id={id} {...otherProps}>
      <TableHeader id={id}>
        {columns.map((column) => {
          return (
            <TableHeaderData className={column.name} key={`${id}-header-${column.name}`}>
              {column.content}
            </TableHeaderData>
          );
        })}
      </TableHeader>
      <TableBody id={id}>
        {data.map((d, idx) => {
          return (
            <TableRow key={`${id}-row-${idx}`}>
              {columns.map((column) => {
                const arg = column.property === '@' ? d : d[column.property];
                const transformer = column.transformer ?? defaultTransformer;
                return (
                  <TableRowData className={column.name} key={`${id}-row-${idx}-${column.name}`}>
                    <span className="mobile-title">%{column.mobileTitle}:</span>
                    {transformer(arg, idx)}
                  </TableRowData>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
