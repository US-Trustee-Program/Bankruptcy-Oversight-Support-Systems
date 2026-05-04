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
  const wrapperClasses = ['cams-table', 'cams-table--responsive', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div id={id} className={wrapperClasses}>
      {caption && <div className="cams-table__caption">{caption}</div>}
      <div role="table" {...rest}>
        {children}
      </div>
    </div>
  );
}
