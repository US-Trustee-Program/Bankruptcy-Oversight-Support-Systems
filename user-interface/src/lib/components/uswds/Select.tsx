import './forms.scss';
import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';
import { SelectRef } from '../../type-declarations/input-fields';

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = Omit<JSX.IntrinsicElements['select'], 'value'> & {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  ariaDescription?: string;
  errorMessage?: string;
  // Flags the select as invalid (red border, aria-invalid) without rendering its
  // own error text — for fields whose validation message is shared and displayed
  // by a parent (e.g. a Year/Status pair with one combined message below both).
  // Mirrors MonthDaySelector's `hasError` prop for the same use case.
  hasError?: boolean;
  // Renders the label in the lighter `usa-hint` style instead of `usa-label`,
  // for sub-fields grouped under a shared heading (e.g. a Year/Status pair).
  compactLabel?: boolean;
};

function Select_(props: SelectProps, ref: React.Ref<SelectRef>) {
  const {
    label,
    options,
    placeholder,
    ariaDescription,
    errorMessage,
    hasError,
    required,
    className,
    compactLabel,
    ...otherProps
  } = props;

  const showsError = !!errorMessage || !!hasError;

  const [selectValue, setSelectValue] = useState<string>(props.value ?? '');
  const [selectDisabled, setSelectDisabled] = useState<boolean>(!!props.disabled);

  const selectRef = useRef<HTMLSelectElement>(null);
  const generatedId = useId();
  const baseId = props.id ?? generatedId;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error-message`;

  useEffect(() => {
    setSelectValue(props.value ?? '');
  }, [props.value]);

  useEffect(() => {
    setSelectDisabled(!!props.disabled);
  }, [props.disabled]);

  function emitChange(value: string) {
    if (props.onChange) {
      const ev = { target: { value } } as React.ChangeEvent<HTMLSelectElement>;
      props.onChange(ev);
    }
  }

  function getValue() {
    return selectValue;
  }

  function setValue(value: string) {
    setSelectValue(value);
  }

  function resetValue() {
    setSelectValue(props.value ?? '');
  }

  function clearValue() {
    setSelectValue('');
    emitChange('');
  }

  function disable(value: boolean) {
    setSelectDisabled(value);
  }

  function focus() {
    selectRef.current?.focus();
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    setSelectValue(ev.target.value);
    props.onChange?.(ev);
  }

  // Standard aria-describedby association — screen readers read both the hint
  // and the error text (when present) when the select receives focus.
  function getAriaDescribedBy(): string | undefined {
    const ids: string[] = [];
    if (ariaDescription) {
      ids.push(hintId);
    }
    if (errorMessage) {
      ids.push(errorId);
    }
    return ids.length > 0 ? ids.join(' ') : undefined;
  }

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable, focus }));

  return (
    <div className={`usa-form-group ${className ?? ''}`}>
      <label
        className={compactLabel ? 'usa-hint' : 'usa-label'}
        id={`${baseId}-label`}
        htmlFor={baseId}
      >
        {label} {required && <span className="required-form-field">*</span>}
      </label>
      {ariaDescription && (
        <div className="usa-hint" id={hintId}>
          {ariaDescription}
        </div>
      )}
      <select
        {...otherProps}
        id={baseId}
        required={required}
        className={`usa-select ${showsError ? 'usa-input--error' : ''}`.trim()}
        aria-invalid={showsError ? 'true' : undefined}
        aria-describedby={getAriaDescribedBy()}
        onChange={handleOnChange}
        data-testid={baseId}
        disabled={selectDisabled}
        value={selectValue}
        ref={selectRef}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Kept mounted (rather than conditionally rendered) so the polite live region
          is registered with assistive tech before its text content changes.
          Uses the app's usa-input__error-message style (non-bold) to match Input/ComboBox. */}
      <div
        id={errorId}
        className={errorMessage ? 'usa-input__error-message' : undefined}
        aria-live="polite"
      >
        {errorMessage}
      </div>
    </div>
  );
}

const Select = forwardRef(Select_);
export default Select;
