import './MonthDaySelector.scss';
import './forms.scss';
import React, { useEffect, useState, type FocusEvent } from 'react';

type MonthDaySelectorProps = {
  id: string;
  label?: string;
  contextLabel?: string;
  // Expected format: "1900-MM-DD", or empty string when no value is set
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: (e: FocusEvent<HTMLDivElement>) => void;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const padded = String(n).padStart(2, '0');
  return { value: padded, label: padded };
});

function getDaysInMonth(month: string): number {
  if (!month) return 31;
  const monthNum = parseInt(month, 10);
  const daysInMonth: Record<number, number> = {
    1: 31,
    2: 28, // No year context, use non-leap year
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31,
  };
  return daysInMonth[monthNum] || 31;
}

function generateDays(maxDays: number) {
  return Array.from({ length: maxDays }, (_, i) => {
    const n = i + 1;
    const padded = String(n).padStart(2, '0');
    return { value: padded, label: padded };
  });
}

function parseValue(value?: string): { month: string; day: string } {
  if (!value) return { month: '', day: '' };
  const parts = value.split('-');
  if (parts.length === 3) {
    return { month: parts[1], day: parts[2] };
  }
  return { month: '', day: '' };
}

export default function MonthDaySelector(props: MonthDaySelectorProps) {
  const { id, label, contextLabel, disabled, required, hasError, className, onFocus, onBlur } =
    props;

  const parsed = parseValue(props.value);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);

  const maxDays = getDaysInMonth(month);
  const DAYS = generateDays(maxDays);

  // Sync local state when the value is reset externally (e.g. form clear)
  useEffect(() => {
    const { month: m, day: d } = parseValue(props.value);
    setMonth(m);
    setDay(d);
  }, [props.value]);

  function handleMonthChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const newMonth = ev.target.value;
    setMonth(newMonth);

    // Clear day if month is cleared or if day exceeds the max days in the new month
    let newDay = day;
    if (!newMonth) {
      newDay = '';
    } else {
      const maxDaysForNewMonth = getDaysInMonth(newMonth);
      const dayNum = parseInt(day, 10);
      if (dayNum > maxDaysForNewMonth) {
        newDay = '';
      }
    }

    if (newDay !== day) {
      setDay(newDay);
    }

    props.onChange?.(newMonth || newDay ? `1900-${newMonth}-${newDay}` : '');
  }

  function handleDayChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const newDay = ev.target.value;
    setDay(newDay);
    props.onChange?.(month || newDay ? `1900-${month}-${newDay}` : '');
  }

  return (
    <div
      className={`usa-form-group month-day-selector ${className ?? ''}`}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {label && (
        <label className="usa-label" id={`${id}-label`}>
          {label}
        </label>
      )}
      <div className="month-day-selector__column">
        <label className="usa-hint" id={`${id}-month-label`} htmlFor={`${id}-month`}>
          Month
        </label>
        <select
          id={`${id}-month`}
          name={`${id}-month`}
          className={`usa-select${hasError ? ' usa-input--error' : ''}`}
          value={month}
          onChange={handleMonthChange}
          disabled={disabled}
          required={required}
          aria-labelledby={label ? `${id}-label ${id}-month-label` : `${id}-month-label`}
          aria-label={!label && contextLabel ? `${contextLabel} Month` : undefined}
          aria-describedby={hasError ? `${id}-error` : undefined}
          aria-invalid={hasError ? 'true' : undefined}
        >
          <option value=""></option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <span className="month-day-selector__separator" aria-hidden="true">
        /
      </span>
      <div className="month-day-selector__column">
        <label className="usa-hint" id={`${id}-day-label`} htmlFor={`${id}-day`}>
          Day
        </label>
        <select
          id={`${id}-day`}
          name={`${id}-day`}
          className={`usa-select${hasError ? ' usa-input--error' : ''}`}
          value={day}
          onChange={handleDayChange}
          disabled={disabled || !month}
          required={required}
          aria-labelledby={label ? `${id}-label ${id}-day-label` : `${id}-day-label`}
          aria-label={!label && contextLabel ? `${contextLabel} Day` : undefined}
          aria-describedby={hasError ? `${id}-error` : undefined}
          aria-invalid={hasError ? 'true' : undefined}
        >
          <option value=""></option>
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
