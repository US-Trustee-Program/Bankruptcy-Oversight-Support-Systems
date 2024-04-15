import { ChangeEventHandler, forwardRef, useImperativeHandle, useState } from 'react';
import { RadioRef } from '../../type-declarations/input-fields';

export interface RadioProps {
  id: string;
  className?: string;
  name: string;
  label: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  value: string;
  checked?: boolean;
  required?: boolean;
}

function RadioComponent(props: RadioProps, ref: React.Ref<RadioRef>) {
  const [isDisabled, setIsDisabled] = useState<boolean>(props.disabled ?? false);
  const [isChecked, setIsChecked] = useState<boolean>(props.checked ?? false);

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  function checked(value: boolean) {
    setIsChecked(value);
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setIsChecked(ev.target.checked);
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  useImperativeHandle(ref, () => ({ checked, disable }));

  return (
    <div className={`usa-form-group usa-radio ${props.className ?? ''}`}>
      <input
        className={`usa-input usa-tooltip usa-radio__input`}
        id={props.id}
        type="radio"
        name={props.name}
        onChange={handleOnChange}
        data-testid={props.id}
        disabled={isDisabled}
        value={props.value}
        checked={isChecked}
        required={props.required}
      />
      <label
        className="usa-radio__label"
        htmlFor={props.id}
        data-testid={`${props.id}-click-target`}
      >
        {props.label}
      </label>
    </div>
  );
}

const Radio = forwardRef(RadioComponent);
export default Radio;
