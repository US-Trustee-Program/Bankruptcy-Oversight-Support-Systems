import './forms.scss';
import './DatePicker.scss';
import { InputRef } from '@/lib/type-declarations/input-fields';
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  type JSX,
} from 'react';
import DateHelper from '@common/date-helper';

const { isInvalidDate, getIsoDate } = DateHelper;

export type DatePickerProps = JSX.IntrinsicElements['input'] & {
  id: string;
  minDate?: string;
  maxDate?: string;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
};

function DatePicker_(props: DatePickerProps, ref: React.Ref<InputRef>) {
  const { id, label, minDate, maxDate } = props;
  const defaultErrorMessage = 'Date is not within allowed range. Enter a valid date.';

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDisabled, setIsDisabled] = useState<boolean>(!!props.disabled);
  const [dateValue, setDateValue] = useState<string | null>(props.value ?? null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function setClassName() {
    return `usa-input ${props.className} ${errorMessage.length ? 'usa-input--error' : ''}`;
  }

  function clearDateValue() {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // This is one wierd trick to make the DatePicker work. The data value must be set to '' then a moment later set to null.
    setDateValue('');
    timeoutRef.current = setTimeout(() => {
      setDateValue(null);
    }, 100);
  }

  function clearValue() {
    setErrorMessage('');
    clearDateValue();
  }

  function resetValue() {
    if (props.value) {
      setDateValue(props.value);
    } else if (props.minDate) {
      setDateValue(props.minDate);
    } else {
      clearDateValue();
    }
  }

  function setValue(value: string) {
    if (value.length > 0) {
      setDateValue(value);
    } else {
      resetValue();
    }
  }

  function getValue(): string {
    return dateValue ?? '';
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const value = new Date(ev.target.value);
    if (isInvalidDate(value) && props.onChange) {
      ev.persist();
      let newValue: string = '';
      if (props.value) {
        newValue = props.value;
      }

      // Modify the event value as needed
      const modifiedEvent = {
        ...ev,
        target: {
          ...ev.target,
          value: newValue,
        },
      };

      props.onChange(modifiedEvent);
    }

    if (props.minDate && props.minDate.length > 0) {
      const minDate = new Date(props.minDate);
      if (value >= minDate) {
        setErrorMessage('');
        if (props.onChange) props.onChange(ev);
        setDateValue(getIsoDate(value));
      } else {
        setErrorMessage(defaultErrorMessage);
        return;
      }
    }
    if (props.maxDate && props.maxDate.length > 0) {
      const maxDate = new Date(props.maxDate);
      if (value <= maxDate) {
        setErrorMessage('');
        if (props.onChange) props.onChange(ev);
        setDateValue(getIsoDate(value));
      } else {
        setErrorMessage(defaultErrorMessage);
      }
    }
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  function focus() {
    inputRef?.current?.focus();
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      getValue,
      setValue,
      disable,
      focus,
    };
  });

  return (
    <div className={`usa-form-group date-picker ${props.className ?? ''}`}>
      <label className="usa-label" id={id + '-date-label'} htmlFor={id + '-date'}>
        {label || ''}
      </label>
      <div className="usa-date-picker">
        <input
          type="date"
          className={setClassName()}
          id={id}
          name={props.name ?? ''}
          aria-labelledby={id + '-date-label'}
          aria-describedby={props['aria-describedby'] ?? id + '-date-hint'}
          aria-live={props['aria-live'] ?? undefined}
          onChange={handleChange}
          data-testid={id}
          min={minDate}
          max={maxDate}
          value={dateValue ?? ''}
          disabled={isDisabled}
          required={props.required}
          ref={inputRef}
        />
      </div>
      <div className="date-error">{errorMessage}</div>
    </div>
  );
}

const DatePicker = forwardRef(DatePicker_);
export default DatePicker;
