import { type JSX, type PropsWithChildren } from 'react';

type CamsTableCellProps = PropsWithChildren<{
  className?: string;
  'data-testid'?: string;
  'data-cell'?: string;
}>;

export function CamsTableCell({ children, className, ...rest }: CamsTableCellProps): JSX.Element {
  const classes = ['cams-table__cell', className].filter(Boolean).join(' ');
  const dataCell = rest['data-cell'];

  return (
    <div className={classes} role="cell" {...rest}>
      {dataCell && dataCell !== '' && <span className="cams-table__cell-label">{dataCell}: </span>}
      {children}
    </div>
  );
}
