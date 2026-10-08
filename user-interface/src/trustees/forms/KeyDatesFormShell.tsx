import { ReactNode } from 'react';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { Stop } from '@/lib/components/Stop';

export interface KeyDatesFormShellProps {
  isLoading: boolean;
  loadingId: string;
  canManage: boolean;
  forbiddenMessage: string;
  title: ReactNode;
  containerTestId: string;
  /** Defaults to 'edit-upcoming-key-dates'; some forms use their own class/scss. */
  containerClassName?: string;
  /** Shared suffix for the save/cancel button ids, e.g. 'bond-key-dates' ->
   *  save-bond-key-dates / cancel-bond-key-dates. */
  idBase: string;
  /** Whether to also render data-testid on the save/cancel buttons. Preserves
   *  today's inconsistency across forms rather than papering over it. */
  withTestIds?: boolean;
  isSaving: boolean;
  isSaveDisabled: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * Shared page skeleton for the trustee "key dates" forms: loading spinner,
 * forbidden stop, heading, field slot, and save/cancel button group. Pairs
 * with useKeyDatesFormShell, which owns the load/save/navigate logic this
 * component's props are driven by.
 */
export function KeyDatesFormShell(props: Readonly<KeyDatesFormShellProps>) {
  const {
    isLoading,
    loadingId,
    canManage,
    forbiddenMessage,
    title,
    containerTestId,
    containerClassName,
    idBase,
    withTestIds,
    isSaving,
    isSaveDisabled,
    onSave,
    onCancel,
    children,
  } = props;

  if (isLoading) {
    return <LoadingSpinner id={loadingId} />;
  }

  if (!canManage) {
    return <Stop id="forbidden-alert" title="Forbidden" message={forbiddenMessage} asError />;
  }

  return (
    <div className={containerClassName ?? 'edit-upcoming-key-dates'} data-testid={containerTestId}>
      <h3>{title}</h3>
      {children}
      <div className="usa-button-group">
        <Button
          id={`save-${idBase}`}
          data-testid={withTestIds ? `button-save-${idBase}` : undefined}
          onClick={onSave}
          disabled={isSaving || isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id={`cancel-${idBase}`}
          data-testid={withTestIds ? `button-cancel-${idBase}` : undefined}
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
