import { useState, useEffect } from 'react';
import MonthDaySelector from './MonthDaySelector';
import Icon from './Icon';
import Button, { UswdsButtonStyle } from './Button';
import { validateMonthDayRange } from '@common/cams/trustee-upcoming-report-dates';

type MonthDayRangeSelectorProps = {
  id: string;
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  externalError?: string;
  submitted?: boolean;
};

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
    submitted,
  } = props;

  const [internalError, setInternalError] = useState('');

  // Validate whenever values change using common library validator
  useEffect(() => {
    const result = validateMonthDayRange(startValue, endValue);
    const errorMessage = result.valid ? '' : result.reasons?.[0] || '';
    setInternalError(errorMessage);
    onValidationChange?.(result.valid ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startValue, endValue]);

  // External errors take precedence over internal errors; internal errors only show after submission
  const displayError = externalError || (submitted ? internalError : '');
  const hasError = !!displayError;

  const hasValue = !!(startValue || endValue);

  function handleClear() {
    onStartChange('');
    onEndChange('');
  }

  return (
    <div className="review-period-group">
      <div className="review-period-header">
        <label className="usa-label" htmlFor={`${id}-start-month`}>
          {label}
        </label>
        {hasValue && (
          <Button
            id={`${id}-clear`}
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={handleClear}
            aria-label={`Clear ${label}`}
          >
            Clear
          </Button>
        )}
      </div>
      <div className="review-period-row">
        <MonthDaySelector
          id={`${id}-start`}
          value={startValue}
          onChange={onStartChange}
          hasError={hasError}
          submitted={submitted}
        />
        <span className="review-period-separator" aria-hidden="true">
          <Icon name="remove" />
        </span>
        <MonthDaySelector
          id={`${id}-end`}
          value={endValue}
          onChange={onEndChange}
          hasError={hasError}
          submitted={submitted}
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
