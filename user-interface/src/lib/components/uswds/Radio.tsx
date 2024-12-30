import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { RadioRef } from '../../type-declarations/input-fields';
import Button, { UswdsButtonStyle } from './Button';

export interface RadioProps {
  id: string;
  className?: string;
  name: string;
  label: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  value: string | number;
  checked?: boolean;
  required?: boolean;
  title?: string;
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
        className={`usa-input usa-tooltip usa-radio__input`}
        id={radioTestId}
        type="radio"
        name={props.name}
        data-testid={radioTestId}
        title={props.title}
        disabled={isDisabled}
        value={props.value}
        checked={isChecked()}
        required={props.required}
        onChange={() => {}}
        tabIndex={-1}
        ref={inputRef}
      />
      <label htmlFor={radioTestId}>
        <Button
          id={`${radioTestId}-click-target`}
          className={`usa-input usa-radio__label ${UswdsButtonStyle.Unstyled}`}
          title={props.title}
          onClick={handleOnClick}
        >
          {props.label}
        </Button>
      </label>
    </div>
  );
}

const Radio = forwardRef(RadioComponent);
export default Radio;
