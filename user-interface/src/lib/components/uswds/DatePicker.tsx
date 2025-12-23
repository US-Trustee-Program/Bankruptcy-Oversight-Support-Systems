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

const { isInvalidDate } = DateHelper;

export type DatePickerProps = JSX.IntrinsicElements['input'] & {
  id: string;
  minDate?: string;
  maxDate?: string;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (ev: React.FocusEvent<HTMLInputElement>) => void;
  label?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
  customErrorMessage?: string;
};

function DatePicker_(props: DatePickerProps, ref: React.Ref<InputRef>) {
  const { id, label, minDate, maxDate } = props;
  const defaultErrorMessage = 'Date is not within allowed range. Enter a valid date.';

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [errorMessage, setErrorMessage] = useState<string>('');

  // Use custom error message from parent if provided
  const displayErrorMessage = props.customErrorMessage || errorMessage;
  const [isDisabled, setIsDisabled] = useState<boolean>(!!props.disabled);
  const [dateValue, setDateValue] = useState<string | null>(props.value ?? null);

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
    const rawValue = ev.target.value;

    // Always update the internal state to match what the user typed
    // This is required for controlled inputs to work properly
    setDateValue(rawValue || null);

    // Call parent's onChange immediately to keep it informed
    if (props.onChange) {
      props.onChange(ev);
    }

    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Clear errors if field is empty or incomplete
    if (!rawValue) {
      setErrorMessage('');
      return;
    }

    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(rawValue);
    if (!isCompleteDate) {
      setErrorMessage('');
      return;
    }

    const value = new Date(rawValue);

    if (isInvalidDate(value)) {
      setErrorMessage('');
      return;
    }

    const year = value.getFullYear();
    if (year < 1900 || year > 2200) {
      setErrorMessage('');
      return;
    }

    // Debounce validation to avoid showing errors while user is typing
    validationTimeoutRef.current = setTimeout(() => {
      let hasError = false;

      if (props.minDate && props.minDate.length > 0) {
        const minDate = new Date(props.minDate);
        if (value < minDate) {
          setErrorMessage(defaultErrorMessage);
          hasError = true;
        }
      }

      if (!hasError && props.maxDate && props.maxDate.length > 0) {
        const maxDate = new Date(props.maxDate);
        if (value > maxDate) {
          setErrorMessage(defaultErrorMessage);
          hasError = true;
        }
      }

      if (!hasError) {
        setErrorMessage('');
      }
    }, 500);
  }

  function handleBlur(ev: React.FocusEvent<HTMLInputElement>) {
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

  // Build aria-describedby IDs
  const getAriaDescribedBy = () => {
    const ids: string[] = [];

    // Add custom aria-describedby if provided
    if (props['aria-describedby']) {
      ids.push(props['aria-describedby']);
    }

    // Add error message ID if there's an error
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
          min={minDate}
          max={maxDate}
          value={dateValue ?? ''}
          disabled={isDisabled}
          required={props.required}
          ref={inputRef}
        />
      </div>
      <div id={`${id}-error`} className="date-error" aria-live="polite">
        {displayErrorMessage}
      </div>
    </div>
  );
}

const DatePicker = forwardRef(DatePicker_);
export default DatePicker;
