import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { DateRange, DateRangePickerRef, InputRef } from '@/lib/type-declarations/input-fields';
import DatePicker, { DatePickerProps } from './DatePicker';
import './DateRangePicker.scss';
import useDebounce from '@/lib/hooks/UseDebounce';
import { ValidatorFunction } from 'common/src/cams/validation';

export const formatDateForVoiceOver = (dateString: string) => {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    console.error('DateRangePicker', 'Invalid date supplied for formatting:');
  }
};

interface DateRangePickerProps extends Omit<DatePickerProps, 'value' | 'validators'> {
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  endDateLabel?: string;
  value?: DateRange;
  disabled?: boolean;
  ariaDescription?: string;
  startDateValidators?: ValidatorFunction[];
  endDateValidators?: ValidatorFunction[];
}

function DateRangePicker_(props: DateRangePickerProps, ref: React.Ref<DateRangePickerRef>) {
  const {
    id,
    startDateLabel,
    endDateLabel,
    ariaDescription,
    min,
    max,
    value,
    disabled,
    required,
    startDateValidators,
    endDateValidators,
  } = props;

  const startDateRef = useRef<InputRef>(null);
  const endDateRef = useRef<InputRef>(null);

  const [startDateError, setStartDateError] = useState<string>('');
  const [endDateError, setEndDateError] = useState<string>('');

  // Updated on blur to set cross-field min/max constraints
  const [startDateValue, setStartDateValue] = useState<string>('');
  const [endDateValue, setEndDateValue] = useState<string>('');

  const debounce = useDebounce();

  // Start date max should be the earlier of: end date value or global max
  function getStartDateMax(): string | undefined {
    if (!endDateValue && !max) return undefined;
    if (!endDateValue) return max;
    if (!max) return endDateValue;
    return endDateValue < max ? endDateValue : max;
  }

  // End date min should be the later of: start date value or global min
  function getEndDateMin(): string | undefined {
    if (!startDateValue && !min) return undefined;
    if (!startDateValue) return min;
    if (!min) return startDateValue;
    return startDateValue > min ? startDateValue : min;
  }

  const startDateMax = getStartDateMax();
  const endDateMin = getEndDateMin();

  function validateDateRange(startValue: string, endValue: string) {
    setStartDateError('');
    setEndDateError('');

    // Only validate if both dates are complete (YYYY-MM-DD format)
    const isCompleteStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startValue);
    const isCompleteEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endValue);

    if (!isCompleteStartDate || !isCompleteEndDate) {
      return;
    }

    const startDate = new Date(startValue);
    const endDate = new Date(endValue);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return;
    }

    if (startDate > endDate) {
      setStartDateError('Start date must be before end date.');
    }
  }

  function handleDateChange(
    ev: React.ChangeEvent<HTMLInputElement>,
    startValue: string,
    endValue: string,
    callback?: (ev: React.ChangeEvent<HTMLInputElement>) => void,
  ) {
    setStartDateError('');
    setEndDateError('');

    if (callback) callback(ev);

    if (startValue && endValue) {
      validateDateRange(startValue, endValue);
    }
  }

  function onStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const newStartValue = ev.target.value;
    const currentEndValue = endDateRef.current?.getValue() ?? '';
    setStartDateValue(newStartValue);
    setEndDateValue(currentEndValue);
    handleDateChange(ev, newStartValue, currentEndValue, props.onStartDateChange);
  }

  function onEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const currentStartValue = startDateRef.current?.getValue() ?? '';
    const newEndValue = ev.target.value;
    setStartDateValue(currentStartValue);
    setEndDateValue(newEndValue);
    handleDateChange(ev, currentStartValue, newEndValue, props.onEndDateChange);
  }

  function handleDateBlur(startValue: string, endValue: string) {
    if (!startValue || !endValue) {
      return;
    }
    validateDateRange(startValue, endValue);
  }

  function onStartDateBlur(ev: React.FocusEvent<HTMLInputElement>) {
    const newStartValue = ev.target.value;
    const currentEndValue = endDateRef.current?.getValue() ?? '';
    setStartDateValue(newStartValue);
    setEndDateValue(currentEndValue);
    handleDateBlur(newStartValue, currentEndValue);
  }

  function onEndDateBlur(ev: React.FocusEvent<HTMLInputElement>) {
    const currentStartValue = startDateRef.current?.getValue() ?? '';
    const newEndValue = ev.target.value;
    setStartDateValue(currentStartValue);
    setEndDateValue(newEndValue);
    handleDateBlur(currentStartValue, newEndValue);
  }

  function clearValue() {
    setStartDateError('');
    setEndDateError('');
    setStartDateValue('');
    setEndDateValue('');

    startDateRef.current?.clearValue();
    endDateRef.current?.clearValue();

    debounce(() => {
      startDateRef.current?.clearValue();
      endDateRef.current?.clearValue();
    }, 250);
  }

  function resetValue() {
    setStartDateError('');
    setEndDateError('');
    setStartDateValue('');
    setEndDateValue('');

    startDateRef.current?.resetValue();
    endDateRef.current?.resetValue();
  }

  function setValue(options: { start?: string; end?: string } = {}) {
    startDateRef.current?.setValue(options.start ?? '');
    endDateRef.current?.setValue(options.end ?? '');
  }

  function getValue(): string {
    throw new Error('Not implemented');
  }

  function disable(value: boolean) {
    startDateRef.current?.disable(value);
    endDateRef.current?.disable(value);
  }

  function focus() {
    startDateRef?.current?.focus();
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
      disable,
      getValue,
      focus,
    };
  });

  const getDateRangeDescription = () => {
    const minStr = typeof min === 'string' ? min : undefined;
    const maxStr = typeof max === 'string' ? max : undefined;

    if (minStr && maxStr) {
      const formattedMin = formatDateForVoiceOver(minStr);
      const formattedMax = formatDateForVoiceOver(maxStr);
      return `Valid dates are between ${formattedMin} and ${formattedMax}.`;
    } else if (minStr) {
      const formattedMin = formatDateForVoiceOver(minStr);
      return `Valid dates are on or after ${formattedMin}.`;
    } else if (maxStr) {
      const formattedMax = formatDateForVoiceOver(maxStr);
      return `Valid dates are on or before ${formattedMax}.`;
    }
    return '';
  };

  const dateRangeConstraint = getDateRangeDescription();

  return (
    <div id={id} className="usa-date-range-picker" data-min-date={min} data-max-date={max}>
      <DatePicker
        ref={startDateRef}
        id={`${id}-date-start`}
        min={min}
        max={startDateMax}
        onChange={onStartDateChange}
        onBlur={onStartDateBlur}
        label={startDateLabel || 'Start date'}
        aria-describedby={`${id}-start-hint ${id}-aria-description`}
        aria-live={props['aria-live'] ?? undefined}
        name="event-date-start"
        value={value?.start}
        disabled={disabled}
        required={required}
        customErrorMessage={startDateError}
        validators={startDateValidators}
      />
      <span id={`${id}-start-hint`} className="usa-hint" hidden>
        Enter the beginning date for the range. Use the format MM/DD/YYYY or select from the
        calendar.
        {dateRangeConstraint && ` ${dateRangeConstraint}`}
      </span>

      <DatePicker
        ref={endDateRef}
        id={`${id}-date-end`}
        min={endDateMin}
        max={max}
        onChange={onEndDateChange}
        onBlur={onEndDateBlur}
        label={endDateLabel || 'End date'}
        aria-describedby={`${id}-end-hint ${id}-aria-description`}
        aria-live={props['aria-live'] ?? undefined}
        name="event-date-end"
        value={value?.end}
        disabled={disabled}
        required={required}
        customErrorMessage={endDateError}
        validators={endDateValidators}
      />
      <span id={`${id}-end-hint`} className="usa-hint" hidden>
        Enter the ending date for the range. Use the format MM/DD/YYYY or select from the calendar.
        {dateRangeConstraint && ` ${dateRangeConstraint}`}
      </span>
      <span id={`${id}-aria-description`} aria-live="polite" hidden>
        <span>Format: numeric month / numeric day / 4-digit year.</span>
        {ariaDescription && <span aria-label={ariaDescription}></span>}
        {(min || max) && (
          <span>
            (Valid date range is
            {min && (
              <>
                {max && <>within </>}
                {min}
              </>
            )}
            {max && (
              <>
                {min && <> and </>}
                {!min && <> on or before </>}
                {max}
              </>
            )}
            )
          </span>
        )}
        {(min || max) && typeof min === 'string' && typeof max === 'string' && (
          <span>
            Date range is currently set to {min && <>start {formatDateForVoiceOver(min)}</>}
            {max && <>end {formatDateForVoiceOver(max)}</>}
          </span>
        )}{' '}
        - <span>Use arrow keys to navigate days or type the date directly.</span>
      </span>
    </div>
  );
}
const DateRangePicker = forwardRef(DateRangePicker_);
export default DateRangePicker;
