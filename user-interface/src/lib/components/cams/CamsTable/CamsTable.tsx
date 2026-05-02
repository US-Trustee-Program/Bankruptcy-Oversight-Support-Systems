import { type JSX, type PropsWithChildren } from 'react';
import './CamsTable.scss';

type CamsTableProps = PropsWithChildren<{
  id?: string;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  caption?: string;
}>;

export function CamsTable({
  children,
  id,
  className,
  caption,
  ...rest
}: CamsTableProps): JSX.Element {
  const classes = ['cams-table', 'cams-table--responsive', className].filter(Boolean).join(' ');
  return (
    <div id={id} className={classes} role="table" {...rest}>
      {caption && (
        <div className="cams-table__caption" role="caption">
          {caption}
        </div>
      )}
      {children}
    </div>
  );
}
