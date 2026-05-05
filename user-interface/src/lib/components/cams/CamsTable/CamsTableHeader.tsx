import { type JSX, type PropsWithChildren } from 'react';

type CamsTableHeaderProps = PropsWithChildren<{
  className?: string;
}>;

export function CamsTableHeader({ children, className }: CamsTableHeaderProps): JSX.Element {
  const classes = ['cams-table__header-group', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="rowgroup">
      <div className="cams-table__header-row" role="row">
        {children}
      </div>
    </div>
  );
}
