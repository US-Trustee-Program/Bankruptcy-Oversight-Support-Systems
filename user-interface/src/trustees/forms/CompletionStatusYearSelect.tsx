import { validateCompletionPairPresence } from '@common/cams/trustee-upcoming-key-dates';
import Select from '@/lib/components/uswds/Select';
import PairFieldGroup from './PairFieldGroup';

interface CompletionStatusOption<T extends string> {
  value: T;
  label: string;
}

export interface CompletionStatusYearSelectProps<T extends string> {
  /** Prefix used for ids, test ids, and (by default) class names, e.g. 'audit-completion' or 'tpr-completion'. */
  idPrefix: string;
  title: string;
  year: number | '';
  status: T | '';
  onYearChange: (year: number | '') => void;
  onStatusChange: (status: T | '') => void;
  /** Label the pair error is phrased around, e.g. 'Audit Completion Status'. */
  errorLabel: string;
  /** The year dropdown's options, e.g. getCompletionYearOptions() or getFiscalYearOptions(). */
  yearOptions: number[];
  /** The status dropdown's stored values and displayed labels, e.g. COMPLETE/INCOMPLETE or CLOSED/NOT_CLOSED. */
  statusOptions: readonly CompletionStatusOption<T>[];
  /** Defaults to `${idPrefix}-status-group`; override to match a caller's own stylesheet. */
  groupClassName?: string;
  /** Defaults to `${idPrefix}-status-group__row`; override to match a caller's own stylesheet. */
  rowClassName?: string;
}

export default function CompletionStatusYearSelect<T extends string>(
  props: Readonly<CompletionStatusYearSelectProps<T>>,
) {
  const {
    idPrefix,
    title,
    year,
    status,
    onYearChange,
    onStatusChange,
    errorLabel,
    yearOptions,
    statusOptions,
    groupClassName = `${idPrefix}-status-group`,
    rowClassName = `${idPrefix}-status-group__row`,
  } = props;
  const pairError = validateCompletionPairPresence(year, status, errorLabel);

  return (
    <PairFieldGroup
      idPrefix={idPrefix}
      groupClassName={groupClassName}
      rowClassName={rowClassName}
      header={<p className={`usa-label ${idPrefix}-status-title`}>{title}</p>}
      error={pairError}
    >
      {({ hasError, ariaDescribedBy }) => (
        <>
          <Select
            id={`${idPrefix}-year`}
            label="Year"
            compactLabel
            hasError={hasError}
            ariaDescribedBy={ariaDescribedBy}
            placeholder="- Select -"
            options={yearOptions.map((y) => ({
              value: String(y),
              label: String(y),
            }))}
            value={year === '' ? '' : String(year)}
            onChange={(e) => {
              const val = e.target.value;
              onYearChange(val ? Number(val) : '');
            }}
          />
          <Select
            id={`${idPrefix}-status`}
            label="Status"
            compactLabel
            hasError={hasError}
            ariaDescribedBy={ariaDescribedBy}
            placeholder="- Select -"
            options={[...statusOptions]}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as T)}
          />
        </>
      )}
    </PairFieldGroup>
  );
}
