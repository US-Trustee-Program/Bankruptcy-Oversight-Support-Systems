import './MonthYearSelector.scss';
import { useEffect, useRef, useState } from 'react';

type MonthYearSelectorProps = {
  id: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  onValidationChange?: (hasError: boolean) => void;
  disabled?: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const padded = String(n).padStart(2, '0');
  return { value: padded, label: padded };
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - i);

function parseValue(value?: string): { month: string; year: string } {
  if (!value) return { month: '', year: '' };
  const parts = value.split('-');
  if (parts.length === 3) {
    return { month: parts[1], year: parts[0] };
  }
  return { month: '', year: '' };
}

export default function MonthYearSelector(props: Readonly<MonthYearSelectorProps>) {
  const { id, label, disabled } = props;

  const parsed = parseValue(props.value);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  useEffect(() => {
    const { month: m, year: y } = parseValue(props.value);
    setMonth(m);
    setYear(y);
    const isIncomplete = !!m !== !!y;
    hasErrorRef.current = isIncomplete;
    setErrorMessage(isIncomplete ? 'Both month and year are required.' : '');
    props.onValidationChange?.(isIncomplete);
  }, [props.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const [errorMessage, setErrorMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const hasErrorRef = useRef(false);

  function emit(newMonth: string, newYear: string) {
    const hasMonth = !!newMonth;
    const hasYear = !!newYear;
    const isIncomplete = hasMonth !== hasYear;
    hasErrorRef.current = isIncomplete;
    setErrorMessage(isIncomplete ? 'Both month and year are required.' : '');
    props.onChange?.(hasMonth && hasYear ? `${newYear}-${newMonth}-01` : '');
  }

  function handleMonthChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const newMonth = ev.target.value;
    setMonth(newMonth);
    emit(newMonth, year);
  }

  function handleYearChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const newYear = ev.target.value;
    setYear(newYear);
    emit(month, newYear);
  }

  function handleFocus() {
    setIsFocused(true);
    props.onValidationChange?.(false);
  }

  function handleBlur(e: React.FocusEvent<HTMLFieldSetElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsFocused(false);
      props.onValidationChange?.(hasErrorRef.current);
    }
  }

  return (
    <fieldset
      className="usa-fieldset month-year-selector"
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {label && <legend className="usa-legend">{label}</legend>}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div className="usa-form-group">
          <label className="usa-hint" htmlFor={`${id}-month`}>
            Month
          </label>
          <select
            id={`${id}-month`}
            data-testid={`${id}-month`}
            className="usa-select"
            value={month}
            onChange={handleMonthChange}
            disabled={disabled}
          >
            <option value=""></option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="usa-form-group">
          <label className="usa-hint" htmlFor={`${id}-year`}>
            Year
          </label>
          <select
            id={`${id}-year`}
            data-testid={`${id}-year`}
            className="usa-select"
            value={year}
            onChange={handleYearChange}
            disabled={disabled}
          >
            <option value=""></option>
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!isFocused && errorMessage && (
        <div className="date-error usa-input__error-message" aria-live="polite">
          {errorMessage}
        </div>
      )}
    </fieldset>
  );
}
