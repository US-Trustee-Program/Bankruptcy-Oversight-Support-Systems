import {
  Ch13CompletionStatus,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import Select from '@/lib/components/uswds/Select';
import PairFieldGroup from './PairFieldGroup';
import { getCompletionYearOptions } from './keyDatesInputDefaults';

type CompletionStatus = Ch13CompletionStatus | '';

interface CompletionStatusYearSelectLabels {
  complete: string;
  incomplete: string;
}

const DEFAULT_STATUS_LABELS: CompletionStatusYearSelectLabels = {
  complete: 'Complete',
  incomplete: 'Incomplete',
};

export interface CompletionStatusYearSelectProps {
  /** Prefix used for ids, test ids, and class names, e.g. 'audit-completion' or 'tpr-completion'. */
  idPrefix: string;
  title: string;
  year: number | '';
  status: CompletionStatus;
  onYearChange: (year: number | '') => void;
  onStatusChange: (status: CompletionStatus) => void;
  /** Label the pair error is phrased around, e.g. 'Audit Completion Status'. */
  errorLabel: string;
  /** Overrides the Status dropdown's displayed labels without changing the stored 'Complete'/'Incomplete' values. */
  statusLabels?: CompletionStatusYearSelectLabels;
}

export default function CompletionStatusYearSelect(
  props: Readonly<CompletionStatusYearSelectProps>,
) {
  const {
    idPrefix,
    title,
    year,
    status,
    onYearChange,
    onStatusChange,
    errorLabel,
    statusLabels = DEFAULT_STATUS_LABELS,
  } = props;
  const pairError = validateCompletionPairPresence(year, status, errorLabel);

  return (
    <PairFieldGroup
      idPrefix={idPrefix}
      groupClassName={`${idPrefix}-status-group`}
      rowClassName={`${idPrefix}-status-group__row`}
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
            options={getCompletionYearOptions().map((y) => ({
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
            options={[
              { value: 'Complete', label: statusLabels.complete },
              { value: 'Incomplete', label: statusLabels.incomplete },
            ]}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as CompletionStatus)}
          />
        </>
      )}
    </PairFieldGroup>
  );
}
