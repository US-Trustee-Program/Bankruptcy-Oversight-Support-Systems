import { type JSX, type PropsWithChildren } from 'react';

type CamsTableRowProps = PropsWithChildren<{
  className?: string;
  'data-testid'?: string;
}>;

export function CamsTableRow({ children, className, ...rest }: CamsTableRowProps): JSX.Element {
  const classes = ['cams-table__row', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="row" {...rest}>
      {children}
    </div>
  );
}
