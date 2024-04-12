import './forms.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface CheckboxProps {
  id: string;
  label?: string;
  value: string;
  name?: string;
  checked?: boolean;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  className?: string;
  required?: boolean;
}

export interface CheckboxRef {
  setChecked: (value: boolean) => void;
  getLabel: () => string;
}

const CheckboxComponent = (props: CheckboxProps, ref: React.Ref<CheckboxRef>) => {
  const [isChecked, setIsChecked] = useState<boolean>(!!props.checked);

  const checkHandler = (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (props.onChange) {
      props.onChange(ev);
    }
    setIsChecked(!isChecked);
  };

  const focusHandler = (ev: React.FocusEvent<HTMLElement>) => {
    if (props.onFocus) {
      props.onFocus(ev);
    }
  };

  function getLabel() {
    return props.label ?? '';
  }

  function setChecked(value: boolean) {
    setIsChecked(value);
  }

  useEffect(() => {
    // initializing isChecked above as a default doesn't work for some reason.
    if (props.checked) setIsChecked(true);
  }, [props.checked]);

  useImperativeHandle(
    ref,
    () => ({
      setChecked,
      getLabel,
    }),
    [],
  );
  const checkboxTestId = `checkbox-${props.id}`;
  const labelTestId = `checkbox-label-${props.id}`;
  return (
    <div className={`usa-form-group uswds-form usa-checkbox ${props.className ?? ''}`}>
      <input
        type="checkbox"
        data-testid={checkboxTestId}
        id={props.id}
        className="usa-checkbox__input"
        name={props.name ?? ''}
        value={props.value}
        checked={isChecked}
        onChange={checkHandler}
        onFocus={focusHandler}
        required={props.required}
      />
      {props.label && (
        <label className="usa-checkbox__label" htmlFor={props.id} data-testid={labelTestId}>
          {props.label}
        </label>
      )}
    </div>
  );
};

const Checkbox = forwardRef(CheckboxComponent);

export default Checkbox;
