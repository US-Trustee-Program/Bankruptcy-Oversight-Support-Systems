import { useState } from 'react';

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
}

export default function DateRangePicker(props: DateRangePickerProps) {
  const { id, startDateLabel, endDateLabel, minDate, maxDate } = props;

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    start: minDate,
    end: maxDate,
  });

  function onStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInternalDateRange({ ...internalDateRange, start: ev.target.value || minDate });
    if (props.onStartDateChange) props.onStartDateChange(ev);
  }

  function onEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInternalDateRange({ ...internalDateRange, end: ev.target.value || maxDate });
    if (props.onEndDateChange) props.onEndDateChange(ev);
  }

  return (
    <div
      id={id}
      className="usa-date-range-picker"
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
          />
        </div>
      </div>
    </div>
  );
}
