import { ChangeEventHandler, forwardRef, useImperativeHandle, useState } from 'react';
import './IconInput.scss';
import Icon from './uswds/Icon';
import { IconInputRef } from './uswds/icon-input';

export interface IconInputProps {
  id: string;
  className?: string;
  type?: string;
  name?: string;
  title?: string;
  icon: string;
  autocomplete?: 'off';
  position?: 'left' | 'right';
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  inputmode?: 'search' | 'text' | 'email' | 'tel' | 'url' | 'none' | 'numeric' | 'decimal';
}

function IconInputComponent(props: IconInputProps, ref: React.Ref<IconInputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  function clearValue() {
    setInputValue('');
  }
  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(ev.target.value);
    if (props.onChange) {
      props.onChange(ev);
    }
  }
  useImperativeHandle(ref, () => {
    return {
      clearValue,
    };
  });
  return (
    <div className="ustp-icon-input">
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
      <Icon className={`usa-icon ${props.className}`} name={props.icon}></Icon>
    </div>
  );
}
const IconInput = forwardRef(IconInputComponent);
export default IconInput;
