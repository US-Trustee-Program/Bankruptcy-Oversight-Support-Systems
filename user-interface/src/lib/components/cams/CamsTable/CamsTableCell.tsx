import { type JSX, type PropsWithChildren } from 'react';

type CamsTableCellProps = PropsWithChildren<{
  className?: string;
  'data-testid'?: string;
  'data-cell'?: string;
}>;

export function CamsTableCell({ children, className, ...rest }: CamsTableCellProps): JSX.Element {
  const classes = ['cams-table__cell', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="cell" {...rest}>
      {children}
    </div>
  );
}
