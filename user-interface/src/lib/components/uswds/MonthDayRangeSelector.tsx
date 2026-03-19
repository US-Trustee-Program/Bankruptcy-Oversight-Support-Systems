import { useState, useEffect } from 'react';
import MonthDaySelector from './MonthDaySelector';
import Icon from './Icon';

type MonthDayRangeSelectorProps = {
  id: string;
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  externalError?: string;
};

const PARTIAL_DATE_ERROR = 'Must be a valid date mm/dd.';

function isPartialMonthDay(value: string): boolean {
  if (!value) return false;
  const parts = value.split('-');
  return parts.length === 3 && (!parts[1] || !parts[2]);
}

export default function MonthDayRangeSelector(props: MonthDayRangeSelectorProps) {
  const {
    id,
    label,
    startValue,
    endValue,
    onStartChange,
    onEndChange,
    onValidationChange,
    externalError,
  } = props;

  const [internalError, setInternalError] = useState('');

  // Validate whenever values change
  useEffect(() => {
    // Check for partial dates
    if (isPartialMonthDay(startValue) || isPartialMonthDay(endValue)) {
      setInternalError(PARTIAL_DATE_ERROR);
      onValidationChange?.(false);
      return;
    }

    // All validations pass
    setInternalError('');
    onValidationChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startValue, endValue]);

  // External errors take precedence over internal errors
  const displayError = externalError || internalError;
  const hasError = !!displayError;

  return (
    <div className="review-period-group">
      <div className="review-period-row">
        <MonthDaySelector
          id={`${id}-start`}
          label={label}
          value={startValue}
          onChange={onStartChange}
          hasError={hasError}
        />
        <span className="review-period-separator" aria-hidden="true">
          <Icon name="remove" />
        </span>
        <MonthDaySelector
          id={`${id}-end`}
          value={endValue}
          onChange={onEndChange}
          hasError={hasError}
        />
      </div>
      {hasError && (
        <div className="date-error usa-input__error-message" aria-live="polite">
          {displayError}
        </div>
      )}
    </div>
  );
}
