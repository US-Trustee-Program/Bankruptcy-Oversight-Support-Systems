import { Ch13CompletionStatus } from '@common/cams/trustee-upcoming-key-dates';
import Select from '@/lib/components/uswds/Select';
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
}

export default function CompletionStatusYearSelect(
  props: Readonly<CompletionStatusYearSelectProps>,
) {
  const { idPrefix, title, year, status, onYearChange, onStatusChange } = props;

  return (
    <div className={`${idPrefix}-status-group`}>
      <p className={`usa-label ${idPrefix}-status-title`}>{title}</p>
      <div className={`${idPrefix}-status-group__row`}>
        <Select
          id={`${idPrefix}-year`}
          label="Year"
          compactLabel
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
          placeholder="- Select -"
          options={[
            { value: 'Complete', label: 'Complete' },
            { value: 'Incomplete', label: 'Incomplete' },
          ]}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as CompletionStatus)}
        />
      </div>
    </div>
  );
}
