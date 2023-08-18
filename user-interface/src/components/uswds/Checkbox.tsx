import './Checkbox.scss';
import { forwardRef, useImperativeHandle, useState } from 'react';

export interface CheckboxProps {
  id: string;
  label?: string;
  value: string;
  checked: boolean;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
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

  function setChecked(value: boolean) {
    setIsChecked(value);
  }

  useImperativeHandle(ref, () => ({ setChecked }), []);

  return (
    <div className={classes}>
      <input
        type="checkbox"
        id={props.id}
        className="usa-checkbox__input"
        value={props.value}
        checked={isChecked}
        onChange={checkHandler}
      />
      {props.label && (
        <label className="usa-checkbox__label" htmlFor={props.id}>
          {props.label}
        </label>
      )}
    </div>
  );
};

const Checkbox = forwardRef(CheckboxComponent);

export default Checkbox;
