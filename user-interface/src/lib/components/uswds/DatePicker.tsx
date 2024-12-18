import './forms.scss';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useImperativeHandle, useState } from 'react';

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

function DatePickerComponent(props: DatePickerProps, ref: React.Ref<InputRef>) {
  const { id, label, minDate, maxDate } = props;

  const [isDisabled, setIsDisabled] = useState<boolean>(
    props.disabled !== undefined ? !!props.disabled : false,
  );

  const [dateValue, setDateValue] = useState<string | undefined>(props.value ?? undefined);

  function clearValue() {
    setDateValue('');
    setTimeout(() => {
      setDateValue(undefined);
    }, 100);
  }

  function resetValue() {
    if (props.value) {
      setDateValue(props.value);
    }
  }

  function setValue(value: string) {
    setDateValue(value);
  }

  function getValue(): string {
    throw new Error('Not implemented');
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      getValue,
      setValue,
      disable,
    };
  });

  return (
    <div className="usa-form-group">
      <label className="usa-label" id={id + '-date-label'} htmlFor={id + '-date'}>
        {label || ''}
      </label>
      <div className="usa-date-picker">
        <input
          type="date"
          className="usa-input"
          id={id}
          name={props.name ?? ''}
          aria-labelledby={id + '-date-label'}
          aria-describedby={props['aria-describedby'] ?? id + '-date-hint'}
          aria-live={props['aria-live'] ?? undefined}
          onChange={props.onChange}
          data-testid={id}
          min={minDate}
          max={maxDate}
          value={dateValue}
          disabled={isDisabled}
          required={props.required}
        />
      </div>
    </div>
  );
}

const DatePicker = forwardRef(DatePickerComponent);
export default DatePicker;
