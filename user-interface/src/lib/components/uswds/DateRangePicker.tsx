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

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    start: minDate,
    end: maxDate,
  });

  const startDateRef = useRef<InputRef>(null);
  const endDateRef = useRef<InputRef>(null);

  const debounce = useDebounce();

  function onStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInternalDateRange({ ...internalDateRange, start: ev.target.value || minDate });
    if (props.onStartDateChange) props.onStartDateChange(ev);
  }

  function onEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInternalDateRange({ ...internalDateRange, end: ev.target.value || maxDate });
    if (props.onEndDateChange) props.onEndDateChange(ev);
  }

  function clearValue() {
    // TODO: This is sus. Why are we setting the state to it's current state. Will this cause a rerender or be rejected by React?
    // Is this possibly causing the "weirdness" that requires us to debounce the clearValue again?
    setInternalDateRange(internalDateRange);
    startDateRef.current?.clearValue();
    endDateRef.current?.clearValue();

    // debounce to solve some funky weirdness with the date type input handling keyboard events after a reset.
    debounce(() => {
      startDateRef.current?.clearValue();
      endDateRef.current?.clearValue();
    }, 250);
  }

  function resetValue() {
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
        maxDate={internalDateRange.end}
        onChange={onStartDateChange}
        label={startDateLabel || 'Start date'}
        aria-describedby={`${id}-aria-description`}
        aria-live={props['aria-live'] ?? undefined}
        name="event-date-start"
        value={value?.start}
        disabled={disabled}
        required={required}
      />
      <DatePicker
        ref={endDateRef}
        id={`${id}-date-end`}
        minDate={internalDateRange.start}
        maxDate={maxDate}
        onChange={onEndDateChange}
        label={endDateLabel || 'End date'}
        aria-describedby={`${id}-aria-description`}
        aria-live={props['aria-live'] ?? undefined}
        name="event-date-end"
        value={value?.end}
        disabled={disabled}
        required={required}
      />
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
        {(internalDateRange?.start || internalDateRange?.end) && (
          <span>
            Date range is currently set to{' '}
            {internalDateRange?.start && (
              <>start {formatDateForVoiceOver(internalDateRange.start)}</>
            )}
            {internalDateRange?.end && <>end {formatDateForVoiceOver(internalDateRange.end)}</>}
          </span>
        )}{' '}
        - <span>Use arrow keys to navigate days or type the date directly.</span>
      </span>
    </div>
  );
}
const DateRangePicker = forwardRef(DateRangePicker_);
export default DateRangePicker;
