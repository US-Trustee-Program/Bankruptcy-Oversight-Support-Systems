import './forms.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { InputRef } from '../../type-declarations/input-fields';
import Icon from './Icon';

// Alias for readability.
//const debounce = setTimeout;

export type InputProps = JSX.IntrinsicElements['input'] & {
  label?: string;
  autocomplete?: 'off';
  position?: 'left' | 'right';
  value?: string;
  icon?: string;
};

const BLANK = '';

function InputComponent(props: InputProps, ref: React.Ref<InputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string>(props.value || BLANK);
  const [inputDisabled, setInputDisabled] = useState<boolean>(
    props.disabled !== undefined ? props.disabled : false,
  );

  function getValue() {
    return inputValue;
  }

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

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <div className="usa-form-group">
      <label className="usa-label" id={props.id + '-label'} htmlFor={props.id}>
        {props.label}
      </label>
      <div className="usa-input-group">
        {props.icon && (
          <div className="usa-input-prefix" aria-hidden="true">
            <Icon focusable={false} name={props.icon}></Icon>
          </div>
        )}
        <input
          className={`usa-input usa-tooltip ${props.className ?? ''}`}
          id={props.id}
          type={props.type}
          name={props.name}
          title={props.title}
          data-position={props.position ?? 'right'}
          autoComplete={props.autocomplete}
          onChange={handleOnChange}
          data-testid={props.id}
          disabled={inputDisabled}
          min={props.min}
          max={props.max}
          pattern={props.pattern}
          inputMode={props.inputMode}
          value={inputValue}
          required={props.required}
        />
      </div>
    </div>
  );
}

const Input = forwardRef(InputComponent);
export default Input;
