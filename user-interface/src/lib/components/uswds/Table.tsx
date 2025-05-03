import './Table.scss';
import React, { forwardRef, PropsWithChildren } from 'react';

export type TableProps = JSX.IntrinsicElements['table'] &
  PropsWithChildren & {
    caption?: string;
    scrollable?: 'true';
    uswdsStyle?: UswdsTableStyle[];
  };

/* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
export interface TableRef extends HTMLTableElement {}

export type TableRowProps = JSX.IntrinsicElements['tr'] & PropsWithChildren;

export type TableRowSortButtonProps = JSX.IntrinsicElements['button'] & {
  direction?: TableSortDirection;
  title?: string;
};

export type TableSortDirection = 'ascending' | 'descending' | 'unsorted';

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
  | 'borderless'
  | 'compact'
  | 'scrollable'
  | 'stacked'
  | 'stacked-header'
  | 'sticky-header'
  | 'striped';

type TableBodyProps = JSX.IntrinsicElements['tbody'] & PropsWithChildren;

type TableHeaderDataProps = JSX.IntrinsicElements['th'] &
  PropsWithChildren & {
    scope?: string;
    sortable?: boolean;
    sortDirection?: TableSortDirection;
    title?: string;
  };

type TableHeaderProps = JSX.IntrinsicElements['thead'] & PropsWithChildren;

type TableRowDataProps = JSX.IntrinsicElements['td'] &
  PropsWithChildren & {
    dataLabel?: string;
    dataSortValue?: string;
  };

export function TableBody(props: TableBodyProps) {
  const { children, id, ...otherProperties } = props;
  return (
    <tbody id={`${id}-table-body`} {...otherProperties}>
      {children}
    </tbody>
  );
}

export function TableHeader(props: TableHeaderProps) {
  const { children, id, ...otherProperties } = props;
  return (
    <thead id={`${id}-table-header`} {...otherProperties}>
      <TableRow>{children}</TableRow>
    </thead>
  );
}

export function TableHeaderData(props: TableHeaderDataProps) {
  const { children, scope, sortable, sortDirection, title, ...otherProperties } = props;
  const role = scope && scope !== 'col' ? 'row' : 'columnheader';
  const ariaSort = sortDirection == 'unsorted' ? undefined : sortDirection;

  return (
    <th
      data-sortable={sortable}
      role={role}
      scope={scope}
      {...otherProperties}
      aria-sort={ariaSort}
    >
      {children}
      {sortable && (
        <TableRowSortButton
          direction={sortDirection}
          title={`Click to sort by ${title} in ${sortDirection} order.`}
        />
      )}
    </th>
  );
}

export function TableRow(props: TableRowProps) {
  const { children, ...otherProperties } = props;
  return <tr {...otherProperties}>{children}</tr>;
}

export function TableRowData(props: TableRowDataProps) {
  const { children, dataLabel, dataSortValue, ...otherProperties } = props;
  return (
    <td
      data-cell={dataLabel}
      data-sort-active={dataSortValue && dataSortValue.length > 0 ? 'true' : undefined}
      data-sort-value={dataSortValue}
      {...otherProperties}
    >
      {children}
    </td>
  );
}

export function TableRowSortButton(props: TableRowSortButtonProps) {
  const { direction, ...otherProperties } = props;
  const sortDirection = direction ?? 'ascending';

  return (
    <button
      className="usa-table__header__button"
      tabIndex={0}
      title={props.title}
      {...otherProperties}
    >
      <svg className="usa-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <g className={sortDirection} fill="transparent">
          {sortDirection === 'unsorted' && (
            <polygon points="15.17 15 13 17.17 13 6.83 15.17 9 16.58 7.59 12 3 7.41 7.59 8.83 9 11 6.83 11 17.17 8.83 15 7.42 16.41 12 21 16.59 16.41 15.17 15"></polygon>
          )}
          {sortDirection === 'ascending' && (
            <path
              d="M17 17L15.59 15.59L12.9999 18.17V2H10.9999V18.17L8.41 15.58L7 17L11.9999 22L17 17Z"
              transform="rotate(180, 12, 12)"
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
export const TableComponent = (
  { caption, children, className, id, uswdsStyle, ...otherProperties }: TableProps,
  ref?: React.Ref<TableRef>,
) => {
  const containerClass =
    'usa-table-container' +
    (className ? ' ' + className + ' ' : '') +
    (uswdsStyle?.includes('scrollable') ? ' usa-table-container--scrollable' : '');

  let tableClass = `usa-table` + (className ? ' ' + className + ' ' : '');
  if (uswdsStyle) {
    const styleArray: string[] = [];
    uswdsStyle.forEach((style) => styleArray.push(`usa-table--${style}`));
    tableClass += [tableClass, ...styleArray].join(' ');
  }

  return (
    <div className={containerClass} id={id} ref={ref}>
      <table className={tableClass} {...otherProperties}>
        {caption && <caption>{caption}</caption>}
        {children}
      </table>
    </div>
  );
};

export const Table = forwardRef(TableComponent);
