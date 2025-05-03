import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableProps,
  TableRow,
  TableRowData,
} from '../../uswds/Table';

const defaultTransformer = (v: unknown) => v?.toString() ?? '';

export type GenericTableProps<T> = {
  columns: GenericTableColumns<T>;
  data: T[];
};

// TODO: Figure out how to get the correct type for the value parameter.
// export type GenericTableTransformer<T> = (arg: T[keyof T] | T, idx?: number) => React.ReactNode;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericTableTransformer = (arg: any, idx?: number) => React.ReactNode;

type ColumnInfo<T> = {
  content: React.ReactNode;
  mobileTitle: string;
  name: string;
  property: '@' | keyof T;
  transformer?: GenericTableTransformer;
};

type GenericTableColumns<T> = ColumnInfo<T>[];

type GenericTablePropsAll<T> = GenericTableProps<T> &
  JSX.IntrinsicElements['table'] &
  Pick<TableProps, 'caption' | 'id' | 'scrollable' | 'uswdsStyle'>;

export function GenericTable<T>(props: GenericTablePropsAll<T>) {
  const { columns, data, id, ...otherProps } = props;
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
