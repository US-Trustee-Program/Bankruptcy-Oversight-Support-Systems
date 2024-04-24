import { forwardRef, PropsWithChildren } from 'react';

type TableHeaderDataProps = PropsWithChildren &
  JSX.IntrinsicElements['th'] & {
    scope?: string;
    sortable?: boolean;
  };

export function TableHeaderData(props: TableHeaderDataProps) {
  const { children, scope, sortable, ...otherProperties } = props;
  return (
    <th data-sortable={sortable} scope={scope} {...otherProperties}>
      {children}
    </th>
  );
}

type TableRowDataProps = PropsWithChildren & JSX.IntrinsicElements['td'];

export function TableRowData(props: TableRowDataProps) {
  const { children, ...otherProperties } = props;
  return <td {...otherProperties}>{children}</td>;
}

type TableRowProps = PropsWithChildren & JSX.IntrinsicElements['tr'];

export function TableRow(props: TableRowProps) {
  const { children, className, ...otherProperties } = props;
  return (
    <tr className={`${className} usa-table-row`} {...otherProperties}>
      {children}
    </tr>
  );
}

type TableHeaderProps = PropsWithChildren & JSX.IntrinsicElements['thead'];

export function TableHeader(props: TableHeaderProps) {
  const { id, children, ...otherProperties } = props;
  return (
    <thead id={`${id}-table-header`} {...otherProperties}>
      <TableRow>{children}</TableRow>
    </thead>
  );
}

type TableBodyProps = PropsWithChildren & JSX.IntrinsicElements['tbody'];

export function TableBody(props: TableBodyProps) {
  const { id, children, ...otherProperties } = props;
  return (
    <tbody id={`${id}-table-body`} {...otherProperties}>
      {children}
    </tbody>
  );
}

// TODO: Find the constants below....
export type UswdsTableStyle = 'one' | 'two';

export type TableProps = PropsWithChildren &
  JSX.IntrinsicElements['table'] & {
    uswdsStyle?: UswdsTableStyle;
    scrollable?: boolean;
    caption?: string;
  };

export type TableParentDivProps = JSX.IntrinsicElements['div'] & {
  uswdsStyle?: UswdsTableStyle;
  scrollable?: boolean;
  caption?: string;
};

export interface TableRef extends HTMLTableElement {}
// TODO: How are we going to handle props for the div AND THE table?? And be able to support the forwardRef?
export const TableComponent = (
  { id, uswdsStyle, className, title, children, ...otherProperties }: TableProps,
  // divProps: TableParentDivProps,
  ref?: React.Ref<TableRef>,
) => {
  return (
    <div
      id={id}
      className={`usa-table-container--scrollable ${uswdsStyle}`}
      tabIndex={0}
      ref={ref}
      // {...divProps}
    >
      <table className={`usa-table usa-table--striped ${className}`} {...otherProperties}>
        {title && <caption>{title}</caption>}
        {children}
      </table>
    </div>
  );
};

export const Table = forwardRef(TableComponent);
