import { DateRange, DateRangePickerRef } from '@/lib/type-declarations/input-fields';
import './DateRangePicker.scss';
import { forwardRef, useImperativeHandle, useState } from 'react';
import DatePicker, { DatePickerProps } from './DatePicker';

// Alias for readability.
const debounce = setTimeout;

export interface DateRangePickerProps extends Omit<DatePickerProps, 'value'> {
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  endDateLabel?: string;
  value?: DateRange;
}

function DateRangePickerComponent(props: DateRangePickerProps, ref: React.Ref<DateRangePickerRef>) {
  const { id, startDateLabel, endDateLabel, minDate, maxDate } = props;

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    start: minDate,
    end: maxDate,
  });
  const [startDateValue, setStartDateValue] = useState<string | null>(props.value?.start ?? null);
  const [endDateValue, setEndDateValue] = useState<string | null>(props.value?.end ?? null);
  const [isDisabled, setIsDisabled] = useState<boolean>(
    props.disabled !== undefined ? props.disabled : false,
  );

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
    setStartDateValue('');
    setEndDateValue('');

    // debounce to solve some funky weirdness with the date type input handling keyboard events after a reset.
    debounce(() => {
      setStartDateValue(null);
      setEndDateValue(null);
    }, 250);
  }

  function resetValue() {
    if (props.value) {
      setStartDateValue(props.value.start ?? '');
      setStartDateValue(props.value.end ?? '');
    } else {
      clearValue();
    }
  }

  // this should take 2 arguments, a start date and an end date and set the values.
  function setValue(options: { start?: string; end?: string } = {}) {
    setStartDateValue(options.start ?? '');
    setStartDateValue(options.end ?? '');
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
      disable,
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
        id={`${id}-date-start`}
        minDate={minDate}
        maxDate={internalDateRange.end}
        onChange={onStartDateChange}
        label={startDateLabel || 'Start date'}
        name="event-date-start"
        value={startDateValue === null ? undefined : startDateValue}
        disabled={isDisabled}
        required={props.required}
      />
      <DatePicker
        id={`${id}-date-end`}
        minDate={internalDateRange.start}
        maxDate={maxDate}
        onChange={onEndDateChange}
        label={endDateLabel || 'End date'}
        name="event-date-end"
        value={endDateValue === null ? undefined : endDateValue}
        disabled={isDisabled}
        required={props.required}
      />
    </div>
  );
}
const DateRangePicker = forwardRef(DateRangePickerComponent);
export default DateRangePicker;
