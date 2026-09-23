import { Ch13CompletionStatus } from '@common/cams/trustee-upcoming-key-dates';
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
        <div className="usa-form-group">
          <label className="usa-hint" htmlFor={`${idPrefix}-year`}>
            Year
          </label>
          <select
            className="usa-select"
            id={`${idPrefix}-year`}
            data-testid={`${idPrefix}-year`}
            value={year}
            onChange={(e) => {
              const val = e.target.value;
              onYearChange(val ? Number(val) : '');
            }}
          >
            <option value=""></option>
            {COMPLETION_YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="usa-form-group">
          <label className="usa-hint" htmlFor={`${idPrefix}-status`}>
            Status
          </label>
          <select
            className="usa-select"
            id={`${idPrefix}-status`}
            data-testid={`${idPrefix}-status`}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as CompletionStatus)}
          >
            <option value=""></option>
            <option value="Complete">Complete</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </div>
      </div>
    </div>
  );
}
