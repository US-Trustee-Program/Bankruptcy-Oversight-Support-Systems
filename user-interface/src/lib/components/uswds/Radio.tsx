import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { RadioRef } from '../../type-declarations/input-fields';

export interface RadioProps {
  id: string;
  className?: string;
  name: string;
  label: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  value: string;
  checked?: boolean;
  required?: boolean;
}

function RadioComponent(props: RadioProps, ref: React.Ref<RadioRef>) {
  const [isDisabled, setIsDisabled] = useState<boolean>(props.disabled ?? false);
  const inputRef = useRef<HTMLInputElement>(null);

  function isChecked() {
    return inputRef.current?.checked;
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  function checked(value: boolean) {
    return inputRef.current?.checked === value;
  }

  function handleOnChange(_ev: React.MouseEvent<HTMLLabelElement>) {
    if (inputRef.current?.checked !== undefined)
      inputRef.current.checked = !inputRef.current.checked;

    if (props.onChange && inputRef.current?.value) {
      props.onChange(inputRef.current?.value);
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
        data-testid={props.id}
        disabled={isDisabled}
        value={props.value}
        checked={isChecked()}
        required={props.required}
        ref={inputRef}
      />
      <label
        className="usa-radio__label"
        htmlFor={props.id}
        onClick={handleOnChange}
        data-testid={`${props.id}-click-target`}
      >
        {props.label}
      </label>
    </div>
  );
}

const Radio = forwardRef(RadioComponent);
export default Radio;
