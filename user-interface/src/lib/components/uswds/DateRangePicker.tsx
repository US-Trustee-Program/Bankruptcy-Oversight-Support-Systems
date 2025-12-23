import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { DateRange, DateRangePickerRef, InputRef } from '@/lib/type-declarations/input-fields';
import DatePicker, { DatePickerProps } from './DatePicker';
import './DateRangePicker.scss';
import useDebounce from '@/lib/hooks/UseDebounce';

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

interface DateRangePickerProps extends Omit<DatePickerProps, 'value'> {
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  endDateLabel?: string;
  value?: DateRange;
  disabled?: boolean;
  ariaDescription?: string;
}

function DateRangePicker_(props: DateRangePickerProps, ref: React.Ref<DateRangePickerRef>) {
  const {
    id,
    startDateLabel,
    endDateLabel,
    ariaDescription,
    minDate,
    maxDate,
    value,
    disabled,
    required,
  } = props;

  const startDateRef = useRef<InputRef>(null);
  const endDateRef = useRef<InputRef>(null);

  const [startDateError, setStartDateError] = useState<string>('');
  const [endDateError, setEndDateError] = useState<string>('');

  const debounce = useDebounce();

  function validateDateRange(startValue: string, endValue: string) {
    // Clear errors first
    setStartDateError('');
    setEndDateError('');

    // Only validate if both dates are complete (YYYY-MM-DD format)
    const isCompleteStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startValue);
    const isCompleteEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endValue);

    if (!isCompleteStartDate || !isCompleteEndDate) {
      return; // Don't validate incomplete dates
    }

    const startDate = new Date(startValue);
    const endDate = new Date(endValue);

    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return; // Don't validate invalid dates
    }

    // Check date range
    if (startDate > endDate) {
      setStartDateError('Start date cannot be after end date.');
    }
  }

  function onStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    // Clear errors when user starts typing
    setStartDateError('');
    setEndDateError('');

    if (props.onStartDateChange) props.onStartDateChange(ev);

    // Validate if we have both dates
    const startValue = ev.target.value;
    const endValue = endDateRef.current?.getValue();
    if (startValue && endValue) {
      validateDateRange(startValue, endValue);
    }
  }

  function onEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    // Clear errors when user starts typing
    setStartDateError('');
    setEndDateError('');

    if (props.onEndDateChange) props.onEndDateChange(ev);

    // Validate if we have both dates
    const endValue = ev.target.value;
    const startValue = startDateRef.current?.getValue();
    if (startValue && endValue) {
      validateDateRange(startValue, endValue);
    }
  }

  function onStartDateBlur(ev: React.FocusEvent<HTMLInputElement>) {
    const startValue = ev.target.value;
    const endValue = endDateRef.current?.getValue();

    if (!startValue || !endValue) {
      return; // Don't validate if either field is empty
    }

    validateDateRange(startValue, endValue);
  }

  function onEndDateBlur(ev: React.FocusEvent<HTMLInputElement>) {
    const endValue = ev.target.value;
    const startValue = startDateRef.current?.getValue();

    if (!startValue || !endValue) {
      return; // Don't validate if either field is empty
    }

    validateDateRange(startValue, endValue);
  }

  function clearValue() {
    // Clear error messages
    setStartDateError('');
    setEndDateError('');

    startDateRef.current?.clearValue();
    endDateRef.current?.clearValue();

    debounce(() => {
      startDateRef.current?.clearValue();
      endDateRef.current?.clearValue();
    }, 250);
  }

  function resetValue() {
    // Clear error messages
    setStartDateError('');
    setEndDateError('');

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

  // Build accessible descriptions for date range constraints
  const getDateRangeDescription = () => {
    if (minDate && maxDate) {
      return `Valid dates are between ${minDate} and ${maxDate}.`;
    } else if (minDate) {
      return `Valid dates are on or after ${minDate}.`;
    } else if (maxDate) {
      return `Valid dates are on or before ${maxDate}.`;
    }
    return '';
  };

  const dateRangeConstraint = getDateRangeDescription();

  return (
    <div
      id={id}
      className="usa-date-range-picker"
      data-min-date={props.minDate}
      data-max-date={props.maxDate}
    >
      <DatePicker
        ref={startDateRef}
        id={`${id}-date-start`}
        minDate={minDate}
        maxDate={maxDate}
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
      />
      <span id={`${id}-start-hint`} className="usa-hint" hidden>
        Enter the beginning date for the range. Use the format MM/DD/YYYY or select from the
        calendar.
        {dateRangeConstraint && ` ${dateRangeConstraint}`}
      </span>

      <DatePicker
        ref={endDateRef}
        id={`${id}-date-end`}
        minDate={minDate}
        maxDate={maxDate}
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
      />
      <span id={`${id}-end-hint`} className="usa-hint" hidden>
        Enter the ending date for the range. Use the format MM/DD/YYYY or select from the calendar.
        {dateRangeConstraint && ` ${dateRangeConstraint}`}
      </span>
      <span id={`${id}-aria-description`} aria-live="polite" hidden>
        <span>Format: numeric month / numeric day / 4-digit year.</span>
        {ariaDescription && <span aria-label={ariaDescription}></span>}
        {(minDate || maxDate) && (
          <span>
            (Valid date range is
            {minDate && (
              <>
                {maxDate && <>within </>}
                {minDate}
              </>
            )}
            {maxDate && (
              <>
                {minDate && <> and </>}
                {!minDate && <> on or before </>}
                {maxDate}
              </>
            )}
            )
          </span>
        )}
        {(minDate || maxDate) && (
          <span>
            Date range is currently set to {minDate && <>start {formatDateForVoiceOver(minDate)}</>}
            {maxDate && <>end {formatDateForVoiceOver(maxDate)}</>}
          </span>
        )}{' '}
        - <span>Use arrow keys to navigate days or type the date directly.</span>
      </span>
    </div>
  );
}
const DateRangePicker = forwardRef(DateRangePicker_);
export default DateRangePicker;
