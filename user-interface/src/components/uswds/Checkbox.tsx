import { forwardRef, useImperativeHandle, useState } from 'react';

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

  function setChecked(value: boolean) {
    setIsChecked(value);
  }

  useImperativeHandle(ref, () => ({ setChecked }), []);
  const checkboxTestId = props.id ? `checkbox-${props.id}` : 'checkbox';
  const labelTestId = props.id ? `checkbox-label-${props.id}` : 'checkbox-label';
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
