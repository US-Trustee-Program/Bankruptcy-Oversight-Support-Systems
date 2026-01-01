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
import Validators from 'common/src/cams/validators';
import { ValidatorFunction } from 'common/src/cams/validation';
import DateHelper, { DEFAULT_MIN_DATE } from 'common/src/date-helper';

export type DatePickerProps = JSX.IntrinsicElements['input'] & {
  id: string;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (ev: React.FocusEvent<HTMLInputElement>) => void;
  label?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
  customErrorMessage?: string;
  validators?: ValidatorFunction[];
};

function DatePicker_(props: DatePickerProps, ref: React.Ref<InputRef>) {
  const { id, label } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [errorMessage, setErrorMessage] = useState<string>('');

  // Use custom error message from parent if provided
  const displayErrorMessage = props.customErrorMessage || errorMessage;
  const [isDisabled, setIsDisabled] = useState<boolean>(!!props.disabled);
  const [dateValue, setDateValue] = useState<string | null>(props.value ?? null);

  // Helper functions to compute min/max with defaults
  const getMin = () => (typeof props.min === 'string' ? props.min : undefined) ?? DEFAULT_MIN_DATE;
  const getMax = () =>
    (typeof props.max === 'string' ? props.max : undefined) ?? DateHelper.getTodaysIsoDate();

  // Centralized validation helper
  function validateDateValue(value: string | null): string[] {
    if (!value) return [];

    const errors: string[] = [];

    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!isCompleteDate) return errors;

    const date = new Date(value);
    if (isNaN(date.getTime())) return errors;

    // Min/max validation
    const minMaxValidator = Validators.dateMinMax(getMin(), getMax());
    const minMaxResult = minMaxValidator(value);
    if (!minMaxResult.valid && minMaxResult.reasons) {
      errors.push(...minMaxResult.reasons);
    }

    // Custom validators
    if (props.validators) {
      props.validators.forEach((validator) => {
        const result = validator(value);
        if (!result.valid && result.reasons) {
          errors.push(...result.reasons);
        }
      });
    }

    return [...new Set(errors)];
  }

  // Reset value helper
  function getResetValue(): string | null {
    if (props.value) return props.value;

    const min = getMin();
    return min || null;
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  // Re-validate when min/max constraints change
  useEffect(() => {
    const errors = validateDateValue(dateValue);
    setErrorMessage(errors.join(' '));
  }, [props.min, props.max, dateValue]);

  function setClassName() {
    return `usa-input ${props.className} ${displayErrorMessage.length ? 'usa-input--error' : ''}`;
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
    setErrorMessage('');
    const resetTo = getResetValue();
    setDateValue(resetTo);
  }

  function setValue(value: string) {
    if (value.length > 0) {
      setDateValue(value);
    } else {
      clearDateValue();
    }
  }

  function getValue(): string {
    return dateValue ?? '';
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = ev.target.value;

    setDateValue(rawValue || null);

    if (props.onChange) {
      props.onChange(ev);
    }

    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (!rawValue) {
      setErrorMessage('');
      return;
    }

    // Debounce validation to avoid showing errors while user is typing
    validationTimeoutRef.current = setTimeout(() => {
      const errors = validateDateValue(rawValue);
      setErrorMessage(errors.join(' '));
    }, 500);
  }

  function handleBlur(ev: React.FocusEvent<HTMLInputElement>) {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    const errors: string[] = [];

    const invalidDateMessage = 'Must be a valid date mm/dd/yyyy.';
    if (inputRef.current && inputRef.current.validity.badInput) {
      errors.push(invalidDateMessage);
    } else {
      errors.push(...validateDateValue(dateValue));
    }

    setErrorMessage([...new Set(errors)].join(' '));

    if (props.onBlur) {
      props.onBlur(ev);
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

  const getAriaDescribedBy = () => {
    const ids: string[] = [];

    if (props['aria-describedby']) {
      ids.push(props['aria-describedby']);
    }

    if (displayErrorMessage) {
      ids.push(`${id}-error`);
    }

    return ids.length > 0 ? ids.join(' ') : undefined;
  };

  return (
    <div className={`usa-form-group date-picker ${props.className ?? ''}`}>
      <label className="usa-label" id={id + '-label'} htmlFor={id}>
        {label || ''}
      </label>
      <div className="usa-date-picker">
        <input
          type="date"
          className={setClassName()}
          id={id}
          name={props.name ?? ''}
          aria-labelledby={id + '-label'}
          aria-describedby={getAriaDescribedBy()}
          aria-invalid={displayErrorMessage ? 'true' : undefined}
          aria-live={props['aria-live'] ?? undefined}
          onChange={handleChange}
          onBlur={handleBlur}
          data-testid={id}
          min={getMin()}
          max={getMax()}
          value={dateValue ?? ''}
          disabled={isDisabled}
          required={props.required}
          ref={inputRef}
        />
      </div>
      <div id={`${id}-error`} className="date-error usa-input__error-message" aria-live="polite">
        {displayErrorMessage}
      </div>
    </div>
  );
}

const DatePicker = forwardRef(DatePicker_);
export default DatePicker;
