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
    return inputRef.current?.checked ?? false;
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  function check(value: boolean) {
    if (inputRef.current) inputRef.current.checked = value;
  }

  function handleOnClick(_ev: React.MouseEvent<HTMLLabelElement>) {
    // clicking a radio button should always select it.  You should not be able to unselect by clicking a selected radio.
    if (inputRef.current?.checked !== undefined) inputRef.current.checked = true;

    if (props.onChange && inputRef.current?.value) {
      props.onChange(inputRef.current?.value);
    }
  }

  useImperativeHandle(ref, () => ({ check, disable, isChecked }));

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
        onChange={() => {}}
        ref={inputRef}
      />
      <label
        className="usa-radio__label"
        htmlFor={props.id}
        onClick={handleOnClick}
        data-testid={`${props.id}-click-target`}
      >
        {props.label}
      </label>
    </div>
  );
}

const Radio = forwardRef(RadioComponent);
export default Radio;
