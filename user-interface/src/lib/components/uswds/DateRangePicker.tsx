import { InputRef } from '@/lib/type-declarations/input-fields';
import './DateRangePicker.scss';
import { forwardRef, useImperativeHandle, useState } from 'react';
import DatePicker, { DatePickerProps } from './DatePicker';

// Alias for readability.
const debounce = setTimeout;

export interface DateRange {
  start?: string;
  end?: string;
}

export interface DateRangePickerProps extends DatePickerProps {
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  endDateLabel?: string;
}

function DateRangePickerComponent(props: DateRangePickerProps, ref: React.Ref<InputRef>) {
  const { id, startDateLabel, endDateLabel, minDate, maxDate } = props;

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    start: minDate,
    end: maxDate,
  });
  const [startDateValue, setStartDateValue] = useState<string | null>(null);
  const [endDateValue, setEndDateValue] = useState<string | null>(null);
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
    throw new Error('Not implemented');
  }

  function setValue() {
    throw new Error('Not implemented');
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
