import { CompletionStatus } from '@common/cams/trustee-upcoming-key-dates';

export interface CompletionStatusValue {
  year: number | '';
  status: CompletionStatus | '';
}

export interface CompletionStatusFieldsProps {
  idPrefix: string;
  legend: string;
  value: CompletionStatusValue;
  onChange: (value: CompletionStatusValue) => void;
}

/**
 * A completion year is always one that has begun, so the options run from the
 * current year backwards rather than forwards like the upcoming-date pickers.
 */
export function buildCompletionYearOptions(currentYear = new Date().getFullYear()): number[] {
  return Array.from({ length: 11 }, (_, i) => currentYear - i);
}

export default function CompletionStatusFields(props: Readonly<CompletionStatusFieldsProps>) {
  const { idPrefix, legend, value, onChange } = props;
  const yearOptions = buildCompletionYearOptions();

  return (
    <fieldset className="usa-fieldset completion-status-fields">
      <legend className="usa-legend">{legend}</legend>
      <div className="completion-status-fields__row">
        <div className="usa-form-group">
          <label className="usa-hint" htmlFor={`${idPrefix}-year`}>
            Year
          </label>
          <select
            className="usa-select"
            id={`${idPrefix}-year`}
            data-testid={`${idPrefix}-year`}
            value={value.year}
            onChange={(ev) =>
              onChange({ ...value, year: ev.target.value ? Number(ev.target.value) : '' })
            }
          >
            <option value="">- Select -</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
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
            value={value.status}
            onChange={(ev) =>
              onChange({ ...value, status: ev.target.value as CompletionStatus | '' })
            }
          >
            <option value="">- Select -</option>
            <option value="Complete">Complete</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}
