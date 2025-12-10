import './Table.scss';
import React, { forwardRef, PropsWithChildren, type JSX } from 'react';

type TableHeaderDataProps = PropsWithChildren &
  JSX.IntrinsicElements['th'] & {
    title?: string;
    scope?: string;
    sortable?: boolean;
    sortDirection?: TableSortDirection;
  };

export function TableHeaderData(props: TableHeaderDataProps) {
  const { children, title, scope, sortable, sortDirection, ...otherProperties } = props;
  const role = scope && scope !== 'col' ? 'row' : 'columnheader';
  const ariaSort = sortDirection == 'unsorted' ? undefined : sortDirection;

  return (
    <th
      data-sortable={sortable}
      scope={scope}
      role={role}
      {...otherProperties}
      aria-sort={ariaSort}
    >
      {children}
      {sortable && (
        <TableRowSortButton
          title={`Click to sort by ${title} in ${sortDirection} order.`}
          direction={sortDirection}
        />
      )}
    </th>
  );
}

type TableRowDataProps = PropsWithChildren &
  JSX.IntrinsicElements['td'] & {
    dataSortValue?: string;
    dataLabel?: string;
  };

export function TableRowData(props: TableRowDataProps) {
  const { children, dataSortValue, dataLabel, ...otherProperties } = props;
  return (
    <td
      data-sort-value={dataSortValue}
      data-cell={dataLabel}
      data-sort-active={dataSortValue && dataSortValue.length > 0 ? 'true' : undefined}
      {...otherProperties}
    >
      {children}
    </td>
  );
}

export type TableRowProps = PropsWithChildren & JSX.IntrinsicElements['tr'];

export function TableRow(props: TableRowProps) {
  const { children, ...otherProperties } = props;
  return <tr {...otherProperties}>{children}</tr>;
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

type TableSortDirection = 'ascending' | 'descending' | 'unsorted';

type TableRowSortButtonProps = JSX.IntrinsicElements['button'] & {
  direction?: TableSortDirection;
  title?: string;
};

export function TableRowSortButton(props: TableRowSortButtonProps) {
  const { direction, ...otherProperties } = props;
  const sortDirection = direction ?? 'ascending';

  return (
    <button
      tabIndex={0}
      className="usa-table__header__button"
      title={props.title}
      {...otherProperties}
    >
      <svg className="usa-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <g className={sortDirection} fill="transparent">
          {sortDirection === 'unsorted' && (
            <polygon points="15.17 15 13 17.17 13 6.83 15.17 9 16.58 7.59 12 3 7.41 7.59 8.83 9 11 6.83 11 17.17 8.83 15 7.42 16.41 12 21 16.59 16.41 15.17 15"></polygon>
          )}
          {sortDirection === 'ascending' && (
            <path
              transform="rotate(180, 12, 12)"
              d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"
            ></path>
          )}
          {sortDirection === 'descending' && (
            <path d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"></path>
          )}
        </g>
      </svg>
    </button>
  );
}

// We need to handle all of the table variants
// NOTE: variants are NOT mutually exclusive.  You can have multiple variants.
//    usa-table-container--scrollable (on the container)
//    usa-table--borderless
//    usa-table--compact
//    usa-table--stacked
//    usa-table--stacked-header
//    usa-table--sticky-header
//    usa-table--striped
export type UswdsTableStyle =
  | 'scrollable'
  | 'borderless'
  | 'compact'
  | 'stacked'
  | 'stacked-header'
  | 'sticky-header'
  | 'striped';

export type TableProps = PropsWithChildren &
  JSX.IntrinsicElements['table'] & {
    uswdsStyle?: UswdsTableStyle[];
    scrollable?: 'true';
    caption?: string;
  };

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
interface TableRef extends HTMLTableElement {}
function Table_(
  { id, uswdsStyle, className, caption, children, ...otherProperties }: TableProps,
  ref?: React.Ref<TableRef>,
) {
  const containerClass =
    'usa-table-container' +
    (className ? ' ' + className + ' ' : '') +
    (uswdsStyle?.includes('scrollable') ? ' usa-table-container--scrollable' : '');

  let tableClass = `usa-table` + (className ? ' ' + className + ' ' : '');
  if (uswdsStyle) {
    const styleArray = uswdsStyle.map((style) => `usa-table--${style}`);
    tableClass += [tableClass, ...styleArray].join(' ');
  }

  return (
    <div id={id} className={containerClass} ref={ref}>
      <table className={tableClass} {...otherProperties}>
        {caption && <caption>{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

const Table = forwardRef(Table_);
export default Table;
