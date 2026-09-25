import {
  Ch13CompletionStatus,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import Select from '@/lib/components/uswds/Select';
import PairFieldGroup from './PairFieldGroup';
import { COMPLETION_YEAR_OPTIONS } from './keyDatesInputDefaults';

type CompletionStatus = Ch13CompletionStatus | '';

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
}

export default function CompletionStatusYearSelect(
  props: Readonly<CompletionStatusYearSelectProps>,
) {
  const { idPrefix, title, year, status, onYearChange, onStatusChange, errorLabel } = props;
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
            options={COMPLETION_YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))}
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
              { value: 'Complete', label: 'Complete' },
              { value: 'Incomplete', label: 'Incomplete' },
            ]}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as CompletionStatus)}
          />
        </>
      )}
    </PairFieldGroup>
  );
}
