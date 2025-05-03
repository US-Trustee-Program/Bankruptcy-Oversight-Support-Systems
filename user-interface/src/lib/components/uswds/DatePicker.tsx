import './forms.scss';
import './DatePicker.scss';

import { InputRef } from '@/lib/type-declarations/input-fields';
import { getIsoDate, isInvalidDate } from '@common/date-helper';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export type DatePickerProps = JSX.IntrinsicElements['input'] & {
  disabled?: boolean;
  id: string;
  label?: string;
  maxDate?: string;
  minDate?: string;
  name?: string;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  value?: string;
};

function DatePickerComponent(props: DatePickerProps, ref: React.Ref<InputRef>) {
  const { id, label, maxDate, minDate } = props;
  const defaultErrorMessage = 'Date is not within allowed range. Enter a valid date.';

  const inputRef = useRef<HTMLInputElement>(null);

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDisabled, setIsDisabled] = useState<boolean>(!!props.disabled);
  const [dateValue, setDateValue] = useState<null | string>(props.value ?? null);

  function setClassName() {
    return `usa-input ${props.className} ${errorMessage.length ? 'usa-input--error' : ''}`;
  }

  function clearDateValue() {
    // This is one wierd trick to make the DatePicker work. The data value must be set to '' then a moment later set to null.
    setDateValue('');
    setTimeout(() => {
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
    if (isInvalidDate(value)) {
      if (props.onChange) {
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
      disable,
      focus,
      getValue,
      resetValue,
      setValue,
    };
  });

  return (
    <div className="usa-form-group date-picker">
      <label className="usa-label" htmlFor={id + '-date'} id={id + '-date-label'}>
        {label || ''}
      </label>
      <div className="usa-date-picker">
        <input
          aria-describedby={props['aria-describedby'] ?? id + '-date-hint'}
          aria-labelledby={id + '-date-label'}
          aria-live={props['aria-live'] ?? undefined}
          className={setClassName()}
          data-testid={id}
          disabled={isDisabled}
          id={id}
          max={maxDate}
          min={minDate}
          name={props.name ?? ''}
          onChange={handleChange}
          ref={inputRef}
          required={props.required}
          type="date"
          value={dateValue ?? undefined}
        />
      </div>
      <div className="date-error">{errorMessage}</div>
    </div>
  );
}

const DatePicker = forwardRef(DatePickerComponent);
export default DatePicker;
