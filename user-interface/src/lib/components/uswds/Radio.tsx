import { ChangeEventHandler, forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { InputRef } from '../../type-declarations/input-fields';

export interface RadioProps {
  id: string;
  className?: string;
  name: string;
  label: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  value: string;
  checked?: boolean;
}

const BLANK = '';

function RadioComponent(props: RadioProps, ref: React.Ref<InputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string>(props.value || BLANK);
  const [inputDisabled, setInputDisabled] = useState<boolean>(
    props.disabled !== undefined ? props.disabled : false,
  );

  function resetValue() {
    setInputValue(props.value || BLANK);
  }

  function clearValue() {
    setInputValue(BLANK);
  }

  function setValue(value: string) {
    setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(ev.target.value);
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  useEffect(() => {
    setInputValue(props.value || BLANK);
  }, [props.value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, disable }));

  return (
    <div className="usa-radio">
      <input
        className={`usa-input usa-tooltip ${props.className} usa-radio__input`}
        id={props.id}
        type="radio"
        name={props.name}
        onChange={handleOnChange}
        data-testid={props.id}
        disabled={inputDisabled}
        value={inputValue}
        checked={props.checked}
      />
      <label className="usa-radio__label" htmlFor={props.id}>
        {props.label}
      </label>
    </div>
  );
}

const Radio = forwardRef(RadioComponent);
export default Radio;
