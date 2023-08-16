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
    <>
      <input
        type="checkbox"
        id={props.id}
        className={props.className ?? ''}
        value={props.value}
        checked={isChecked}
        onChange={checkHandler}
      />
      {props.label && <label htmlFor="checkbox">{props.label}</label>}
    </>
  );
};

const Checkbox = forwardRef(CheckboxComponent);

export default Checkbox;
