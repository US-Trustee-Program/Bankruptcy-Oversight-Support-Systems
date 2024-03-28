import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface CheckboxProps {
  id: string;
  label?: string;
  value: string;
  checked: boolean;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  className?: string;
}

export interface CheckboxRef {
  setChecked: (value: boolean) => void;
  getLabel: () => string;
}

const CheckboxComponent = (props: CheckboxProps, ref: React.Ref<CheckboxRef>) => {
  const [isChecked, setIsChecked] = useState(props.checked);
  let classes = 'usa-checkbox ';

  if (props.className) {
    classes += props.className;
  }

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
    <div className={classes}>
      <input
        type="checkbox"
        data-testid={checkboxTestId}
        id={props.id}
        className="usa-checkbox__input"
        value={props.value}
        checked={isChecked}
        onChange={checkHandler}
        onFocus={focusHandler}
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
