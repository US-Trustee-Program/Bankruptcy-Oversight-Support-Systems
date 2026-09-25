import {
  CompletionStatus,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { FISCAL_YEAR_OPTIONS } from './chapter7PanelKeyDatesInput';
import Select from '@/lib/components/uswds/Select';
import useGroupBlur from '@/lib/hooks/UseGroupBlur';

export interface CompletionStatusValue {
  year: number | '';
  status: CompletionStatus | '';
}

export interface CompletionStatusFieldsProps {
  idPrefix: string;
  legend: string;
  value: CompletionStatusValue;
  onChange: (value: CompletionStatusValue) => void;
  /** Label the pair error is phrased around, e.g. 'Annual Report Completion Status'. */
  errorLabel: string;
}

export default function CompletionStatusFields(props: Readonly<CompletionStatusFieldsProps>) {
  const { idPrefix, legend, value, onChange, errorLabel } = props;
  // Shared with the Chapter 7 Panel completion-year dropdowns so the lookback
  // range stays the same for every appointment type.
  const yearOptions = FISCAL_YEAR_OPTIONS;
  // The Chapter 7 Panel forms show this inline as the pair is edited rather
  // than waiting for a save to fail.
  const pairError = validateCompletionPairPresence(value.year, value.status, errorLabel);
  const pairErrorId = `${idPrefix}-error`;
  const group = useGroupBlur();

  return (
    <fieldset className="usa-fieldset completion-status-fields">
      <legend className="usa-legend">{legend}</legend>
      <div
        className="completion-status-fields__row"
        onFocus={group.handleFocus}
        onBlur={group.handleBlur}
      >
        <Select
          id={`${idPrefix}-year`}
          label="Year"
          compactLabel
          hasError={group.touched && !!pairError}
          ariaDescribedBy={group.touched && pairError ? pairErrorId : undefined}
          placeholder="- Select -"
          options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
          value={value.year === '' ? '' : String(value.year)}
          onChange={(ev) =>
            onChange({ ...value, year: ev.target.value ? Number(ev.target.value) : '' })
          }
        />
        <Select
          id={`${idPrefix}-status`}
          label="Status"
          compactLabel
          hasError={group.touched && !!pairError}
          ariaDescribedBy={group.touched && pairError ? pairErrorId : undefined}
          placeholder="- Select -"
          options={[
            { value: 'COMPLETE', label: 'Complete' },
            { value: 'INCOMPLETE', label: 'Incomplete' },
          ]}
          value={value.status}
          onChange={(ev) =>
            onChange({ ...value, status: ev.target.value as CompletionStatus | '' })
          }
        />
      </div>
      {group.touched && pairError && (
        <div
          className="cams-field-error-message"
          id={pairErrorId}
          data-testid={`${idPrefix}-error`}
        >
          {pairError}
        </div>
      )}
    </fieldset>
  );
}
