import { InputRef } from '@/lib/type-declarations/input-fields';
import './DateRangePicker.scss';
import { forwardRef, useImperativeHandle, useState } from 'react';

// Alias for readability.
const debounce = setTimeout;

export interface DateRange {
  start?: string;
  end?: string;
}

export interface DateRangePickerProps {
  id: string;
  minDate?: string;
  maxDate?: string;
  onStartDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  startDateLabel?: string;
  endDateLabel?: string;
  disabled?: boolean;
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
      className="usa-date-range-picker cams-date-picker"
      data-min-date={props.minDate}
      data-max-date={props.maxDate}
    >
      <div className="usa-form-group">
        <label className="usa-label" id={id + '-date-start-label'} htmlFor={id + '-date-start'}>
          {startDateLabel || 'Start date'}
        </label>
        <div className="usa-date-picker">
          <input
            type="date"
            className="usa-input"
            id={id + '-date-start'}
            name="event-date-start"
            aria-labelledby={id + '-date-start-label'}
            aria-describedby={id + '-date-start-hint'}
            onChange={onStartDateChange}
            min={minDate}
            max={internalDateRange.end}
            data-testid={id + '-date-start'}
            value={startDateValue === null ? undefined : startDateValue}
            disabled={isDisabled}
          />
        </div>
      </div>
      <div className="usa-form-group">
        <label className="usa-label" id={id + '-date-end-label'} htmlFor={id + '-date-end'}>
          {endDateLabel || 'End date'}
        </label>
        <div className="usa-date-picker">
          <input
            type="date"
            className="usa-input"
            id={id + '-date-end'}
            name="event-date-end"
            aria-labelledby={id + '-date-end-label'}
            aria-describedby={id + '-date-end-hint'}
            onChange={onEndDateChange}
            min={internalDateRange.start}
            max={maxDate}
            data-testid={id + '-date-end'}
            value={endDateValue === null ? undefined : endDateValue}
          />
        </div>
      </div>
    </div>
  );
}
const DateRangePicker = forwardRef(DateRangePickerComponent);
export default DateRangePicker;
