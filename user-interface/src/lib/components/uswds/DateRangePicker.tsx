import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { DateRange, DateRangePickerRef, InputRef } from '@/lib/type-declarations/input-fields';
import DatePicker, { DatePickerProps } from './DatePicker';
import './DateRangePicker.scss';

// Alias for readability.
const debounce = setTimeout;

export interface DateRangePickerProps extends Omit<DatePickerProps, 'value'> {
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  endDateLabel?: string;
  value?: DateRange;
  disabled?: boolean;
}

function DateRangePickerComponent(props: DateRangePickerProps, ref: React.Ref<DateRangePickerRef>) {
  const { id, startDateLabel, endDateLabel, minDate, maxDate, value, disabled, required } = props;

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    start: minDate,
    end: maxDate,
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

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
      disable,
      getValue,
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
        name="event-date-end"
        value={value?.end}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}
const DateRangePicker = forwardRef(DateRangePickerComponent);
export default DateRangePicker;
