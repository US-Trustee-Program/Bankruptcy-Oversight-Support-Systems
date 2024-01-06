import { ChangeEventHandler, forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { InputRef } from '../../type-declarations/input-fields';

// Alias for readability.
//const debounce = setTimeout;

export interface InputProps {
  id: string;
  className?: string;
  type?: string;
  name?: string;
  title?: string;
  autocomplete?: 'off';
  position?: 'left' | 'right';
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  value?: string;
  inputmode?: 'search' | 'text' | 'email' | 'tel' | 'url' | 'none' | 'numeric' | 'decimal';
}

function InputComponent(props: InputProps, ref: React.Ref<InputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string | undefined>(props.value);

  function clearValue() {
    setInputValue('');
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(ev.target.value);
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  useEffect(() => {
    setInputValue(props.value);
  }, [props.value]);

  useImperativeHandle(ref, () => ({ clearValue }));

  return (
    <input
      className={`usa-input usa-tooltip ${props.className}`}
      id={props.id}
      type={props.type}
      name={props.name}
      title={props.title}
      data-position="right"
      autoComplete={props.autocomplete}
      onChange={handleOnChange}
      data-testid={props.id}
      disabled={props.disabled}
      min={props.min}
      max={props.max}
      pattern={props.pattern}
      inputMode={props.inputmode}
      value={inputValue}
    />
  );
}

const Input = forwardRef(InputComponent);
export default Input;
