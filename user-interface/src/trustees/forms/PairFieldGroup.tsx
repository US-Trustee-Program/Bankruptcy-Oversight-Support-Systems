import { ReactNode } from 'react';
import useGroupBlur from '@/lib/hooks/UseGroupBlur';

interface PairFieldRenderProps {
  hasError: boolean;
  ariaDescribedBy: string | undefined;
}

export interface PairFieldGroupProps {
  /** Used to build the error message element's id/data-testid, e.g. `${idPrefix}-error`. */
  idPrefix: string;
  /** Class on the outer wrapping div, e.g. 'exam-audit-group'. */
  groupClassName: string;
  /** Class on the row div wrapping the two fields, e.g. 'exam-audit-group__row'. */
  rowClassName: string;
  /** Optional heading rendered above the row, e.g. 'Field Exam or Audit'. */
  title?: string;
  /** Fully custom heading markup, for call sites whose header doesn't fit the plain
   *  `<p className="usa-label">` shape `title` renders. Takes precedence over `title`. */
  header?: ReactNode;
  /** Computed pair-presence (or similar) error text; empty string when valid. */
  error: string;
  children: (renderProps: PairFieldRenderProps) => ReactNode;
}

// Shared skeleton for a row of two (or more) fields that are only valid together: wires up
// useGroupBlur on the row so the error waits for focus to leave the group (see UseGroupBlur.ts),
// and threads the same errorId/hasError into both the fields (via the render-prop) and the
// error message element, so there's exactly one place that computes the id -- fields and the
// error message can't drift out of sync the way hand-copied id strings could.
export default function PairFieldGroup(props: Readonly<PairFieldGroupProps>) {
  const { idPrefix, groupClassName, rowClassName, title, header, error, children } = props;
  const group = useGroupBlur();
  const errorId = `${idPrefix}-error`;
  const showsError = group.touched && !!error;

  return (
    <div className={groupClassName}>
      {header ?? (title && <p className="usa-label">{title}</p>)}
      <div className={rowClassName} onFocus={group.handleFocus} onBlur={group.handleBlur}>
        {children({ hasError: showsError, ariaDescribedBy: showsError ? errorId : undefined })}
      </div>
      {showsError && (
        <div className="cams-field-error-message" id={errorId} data-testid={errorId}>
          {error}
        </div>
      )}
    </div>
  );
}
