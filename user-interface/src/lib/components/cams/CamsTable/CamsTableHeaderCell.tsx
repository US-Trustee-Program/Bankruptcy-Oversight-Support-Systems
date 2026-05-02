import { type JSX, type PropsWithChildren } from 'react';

type CamsTableHeaderCellProps = PropsWithChildren<{
  className?: string;
  'data-testid'?: string;
  scope?: string;
}>;

export function CamsTableHeaderCell({
  children,
  className,
  ...rest
}: CamsTableHeaderCellProps): JSX.Element {
  const classes = ['cams-table__cell', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="columnheader" {...rest}>
      {children}
    </div>
  );
}
