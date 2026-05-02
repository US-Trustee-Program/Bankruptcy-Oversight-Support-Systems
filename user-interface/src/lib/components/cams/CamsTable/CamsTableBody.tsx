import { type JSX, type PropsWithChildren } from 'react';

type CamsTableBodyProps = PropsWithChildren<{
  className?: string;
}>;

export function CamsTableBody({ children, className }: CamsTableBodyProps): JSX.Element {
  const classes = ['cams-table__body', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="rowgroup">
      {children}
    </div>
  );
}
