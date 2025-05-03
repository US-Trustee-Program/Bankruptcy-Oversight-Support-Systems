import { DateRange, DateRangePickerRef, InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import DatePicker, { DatePickerProps } from './DatePicker';
import './DateRangePicker.scss';

// Alias for readability.
const debounce = setTimeout;

export const formatDateForVoiceOver = (dateString: string) => {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (_e) {
    // Invalid date supplied for formatting
  }
};

export interface DateRangePickerProps extends Omit<DatePickerProps, 'value'> {
  ariaDescription?: string;
  disabled?: boolean;
  endDateLabel?: string;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  value?: DateRange;
}

function DateRangePickerComponent(props: DateRangePickerProps, ref: React.Ref<DateRangePickerRef>) {
  const {
    ariaDescription,
    disabled,
    endDateLabel,
    id,
    maxDate,
    minDate,
    required,
    startDateLabel,
    value,
  } = props;

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    end: maxDate,
    start: minDate,
  });

  const startDateRef = useRef<InputRef>(null);
  const endDateRef = useRef<InputRef>(null);

  function onStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInternalDateRange({ ...internalDateRange, start: ev.target.value || minDate });
    if (props.onStartDateChange) props.onStartDateChange(ev);
  }

  function onEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInternalDateRange({ ...internalDateRange, end: ev.target.value || maxDate });
    if (props.onEndDateChange) props.onEndDateChange(ev);
  }

  function clearValue() {
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

  function setValue(options: { end?: string; start?: string } = {}) {
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
      disable,
      focus,
      getValue,
      resetValue,
      setValue,
    };
  });

  return (
    <div
      className="usa-date-range-picker"
      data-max-date={props.maxDate}
      data-min-date={props.minDate}
      id={id}
    >
      <DatePicker
        aria-describedby={`${id}-aria-description`}
        aria-live={props['aria-live'] ?? undefined}
        disabled={disabled}
        id={`${id}-date-start`}
        label={startDateLabel || 'Start date'}
        maxDate={internalDateRange.end}
        minDate={minDate}
        name="event-date-start"
        onChange={onStartDateChange}
        ref={startDateRef}
        required={required}
        value={value?.start}
      />
      <DatePicker
        aria-describedby={`${id}-aria-description`}
        aria-live={props['aria-live'] ?? undefined}
        disabled={disabled}
        id={`${id}-date-end`}
        label={endDateLabel || 'End date'}
        maxDate={maxDate}
        minDate={internalDateRange.start}
        name="event-date-end"
        onChange={onEndDateChange}
        ref={endDateRef}
        required={required}
        value={value?.end}
      />
      <span aria-live="polite" hidden id={`${id}-aria-description`}>
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
const DateRangePicker = forwardRef(DateRangePickerComponent);
export default DateRangePicker;
