import { type JSX, type PropsWithChildren, useId } from 'react';
import './CamsTable.scss';

type CamsTableProps = PropsWithChildren<
  {
    id?: string;
    className?: string;
    'data-testid'?: string;
    caption?: string;
  } & ({ 'aria-label': string; caption?: string } | { 'aria-label'?: string; caption: string })
>;

export function CamsTable({
  children,
  id,
  className,
  caption,
  ...rest
}: CamsTableProps): JSX.Element {
  const captionId = useId();
  const wrapperClasses = ['cams-table', 'cams-table--responsive', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div id={id} className={wrapperClasses}>
      <div role="table" aria-labelledby={caption ? captionId : undefined} {...rest}>
        {caption && (
          <div id={captionId} className="cams-table__caption">
            {caption}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
