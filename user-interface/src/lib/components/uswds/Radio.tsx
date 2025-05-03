import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { RadioRef } from '../../type-declarations/input-fields';
import Button, { UswdsButtonStyle } from './Button';

export interface RadioProps {
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  required?: boolean;
  title?: string;
  value: number | string;
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

  function handleOnClick(_ev: React.MouseEvent<HTMLButtonElement>) {
    // clicking a radio button should always select it.  You should not be able to unselect by clicking a selected radio.
    if (inputRef.current?.checked !== undefined) inputRef.current.checked = true;

    if (props.onChange && inputRef.current?.value) {
      props.onChange(inputRef.current?.value);
    }
  }

  useImperativeHandle(ref, () => ({ check, disable, isChecked }));

  const radioTestId = `radio-${props.id}`;
  return (
    <div className={`usa-form-group usa-radio ${props.className ?? ''}`}>
      <input
        checked={isChecked()}
        className={`usa-input usa-tooltip usa-radio__input`}
        data-testid={radioTestId}
        disabled={isDisabled}
        id={radioTestId}
        name={props.name}
        onChange={() => {}}
        ref={inputRef}
        required={props.required}
        tabIndex={-1}
        title={props.title}
        type="radio"
        value={props.value}
      />
      <label htmlFor={radioTestId}>
        <Button
          className={`usa-input usa-radio__label ${UswdsButtonStyle.Unstyled}`}
          id={`${radioTestId}-click-target`}
          onClick={handleOnClick}
          title={props.title}
        >
          {props.label}
        </Button>
      </label>
    </div>
  );
}

const Radio = forwardRef(RadioComponent);
export default Radio;
