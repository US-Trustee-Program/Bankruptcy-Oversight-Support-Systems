import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RadioRef } from '../../type-declarations/input-fields';
import Button, { UswdsButtonStyle } from './Button';
import './forms.scss';
import './Radio.scss';

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

function Radio_(props: RadioProps, ref: React.Ref<RadioRef>) {
  const [isDisabled, setIsDisabled] = useState<boolean>(props.disabled ?? false);
  const [checkedState, setCheckedState] = useState<boolean>(props.checked ?? false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Controlled mode: when props.checked is provided, derive from it
  useEffect(() => {
    if (props.checked !== undefined) {
      setCheckedState(props.checked);
    }
  }, [props.checked]);

  function isChecked() {
    return checkedState;
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  function check(value: boolean) {
    setCheckedState(value);
  }

  function handleOnClick(
    _ev: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>,
  ) {
    // clicking a radio button should always select it.  You should not be able to unselect by clicking a selected radio.
    setCheckedState(true);

    if (props.onChange && inputRef.current?.value) {
      props.onChange(inputRef.current.value);
    }
  }

  function handleKeyDown(ev: React.KeyboardEvent<HTMLButtonElement>) {
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      handleOnClick(ev);
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
        disabled={isDisabled}
        value={props.value}
        checked={checkedState}
        required={props.required}
        onChange={(e) => setCheckedState(e.target.checked)}
        tabIndex={-1}
        ref={inputRef}
      />
      <label htmlFor={radioTestId}>
        <Button
          id={`${radioTestId}-click-target`}
          className={`usa-input usa-radio__label ${UswdsButtonStyle.Unstyled}`}
          title={props.title}
          onClick={handleOnClick}
          onKeyDown={handleKeyDown}
          role="radio"
          aria-checked={checkedState}
        >
          {props.label}
        </Button>
      </label>
    </div>
  );
}

const Radio = forwardRef(Radio_);
export default Radio;
