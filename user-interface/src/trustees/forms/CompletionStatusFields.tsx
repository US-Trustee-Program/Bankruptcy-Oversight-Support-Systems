import {
  CompletionStatus,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { getFiscalYearOptions } from './chapter7PanelKeyDatesInput';
import Select from '@/lib/components/uswds/Select';
import PairFieldGroup from './PairFieldGroup';

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
  const yearOptions = getFiscalYearOptions();
  // The Chapter 7 Panel forms show this inline as the pair is edited rather
  // than waiting for a save to fail.
  const pairError = validateCompletionPairPresence(value.year, value.status, errorLabel);

  return (
    <PairFieldGroup
      idPrefix={idPrefix}
      groupClassName="completion-status-fields"
      rowClassName="completion-status-fields__row"
      title={legend}
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
            hasError={hasError}
            ariaDescribedBy={ariaDescribedBy}
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
        </>
      )}
    </PairFieldGroup>
  );
}
