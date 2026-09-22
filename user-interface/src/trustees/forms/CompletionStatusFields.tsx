import { FISCAL_YEAR_OPTIONS } from './chapter7PanelKeyDatesInput';

/** Matches the COMPLETE/INCOMPLETE enum the key-dates model stores. */
type CompletionStatus = 'COMPLETE' | 'INCOMPLETE';

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

export default function CompletionStatusFields(props: Readonly<CompletionStatusFieldsProps>) {
  const { idPrefix, legend, value, onChange } = props;
  // Shared with the Chapter 7 Panel completion-year dropdowns so the lookback
  // range stays the same for every appointment type.
  const yearOptions = FISCAL_YEAR_OPTIONS;

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
            <option value="COMPLETE">Complete</option>
            <option value="INCOMPLETE">Incomplete</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}
