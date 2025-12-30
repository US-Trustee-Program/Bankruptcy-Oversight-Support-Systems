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
    minDate,
    maxDate,
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

  const debounce = useDebounce();

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
    handleDateChange(
      ev,
      ev.target.value,
      endDateRef.current?.getValue() ?? '',
      props.onStartDateChange,
    );
  }

  function onEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    handleDateChange(
      ev,
      startDateRef.current?.getValue() ?? '',
      ev.target.value,
      props.onEndDateChange,
    );
  }

  function handleDateBlur(startValue: string, endValue: string) {
    if (!startValue || !endValue) {
      return;
    }
    validateDateRange(startValue, endValue);
  }

  function onStartDateBlur(ev: React.FocusEvent<HTMLInputElement>) {
    handleDateBlur(ev.target.value, endDateRef.current?.getValue() ?? '');
  }

  function onEndDateBlur(ev: React.FocusEvent<HTMLInputElement>) {
    handleDateBlur(startDateRef.current?.getValue() ?? '', ev.target.value);
  }

  function clearValue() {
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

  const getDateRangeDescription = () => {
    if (minDate && maxDate) {
      const formattedMin = formatDateForVoiceOver(minDate);
      const formattedMax = formatDateForVoiceOver(maxDate);
      return `Valid dates are between ${formattedMin} and ${formattedMax}.`;
    } else if (minDate) {
      const formattedMin = formatDateForVoiceOver(minDate);
      return `Valid dates are on or after ${formattedMin}.`;
    } else if (maxDate) {
      const formattedMax = formatDateForVoiceOver(maxDate);
      return `Valid dates are on or before ${formattedMax}.`;
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
        futureDateWarningThresholdYears={props.futureDateWarningThresholdYears}
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
        futureDateWarningThresholdYears={props.futureDateWarningThresholdYears}
        validators={endDateValidators}
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
