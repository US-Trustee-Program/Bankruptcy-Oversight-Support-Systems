import './forms.scss';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { InputRef } from '../../type-declarations/input-fields';
import Button, { UswdsButtonStyle } from './Button';
import Icon from './Icon';

export type InputProps = Omit<JSX.IntrinsicElements['input'], 'onFocus'> & {
  ariaDescription?: string;
  autoComplete?: 'off';
  errorMessage?: string;
  icon?: string;
  includeClearButton?: boolean;
  label?: string;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  position?: 'left' | 'right';
  value?: string;
};

function InputComponent(props: InputProps, ref: React.Ref<InputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string>(props.value || '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

  const { ariaDescription, errorMessage, includeClearButton, ...otherProps } = props;

  const inputRef = useRef<HTMLInputElement>(null);

  function emitChange(value: string) {
    if (props.onChange) {
      const ev = { target: { value } } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(ev);
    }
  }

  function getValue() {
    return inputValue;
  }

  function resetValue() {
    setInputValue(props.value || '');
  }

  function clearValue() {
    setInputValue('');
    emitChange('');
    if (inputRef.current) (inputRef.current as HTMLInputElement).focus();
  }

  function setValue(value: string) {
    setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function ariaDescribedBy() {
    return `input-hint-${props.id ?? Math.random().toString(36).slice(2, 7)}`;
  }

  function handleFocus(ev: React.FocusEvent<HTMLElement>) {
    if (inputRef.current && props.onFocus) {
      ev.target = inputRef.current;
      props.onFocus(ev);
    }
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(ev.target.value);
    if (props.onChange) {
      props.onChange(ev);
    }
  }

  function focus() {
    inputRef?.current?.focus();
  }

  useEffect(() => {
    setInputValue(props.value || '');
  }, [props.value]);

  useImperativeHandle(ref, () => ({ clearValue, disable, focus, getValue, resetValue, setValue }));

  return (
    <>
      <div className="usa-form-group">
        <label className="usa-label" htmlFor={props.id} id={props.id + '-label'}>
          {props.label}
          {props.required && <span className="required-form-field" />}
        </label>
        {ariaDescription && (
          <div className="usa-hint" id={ariaDescribedBy()}>
            {ariaDescription}
          </div>
        )}
        <div
          className={`usa-input-group ${errorMessage && errorMessage.length > 0 ? 'usa-input-group--error' : ''}`}
        >
          <input
            {...otherProps}
            aria-describedby={ariaDescription ? ariaDescribedBy() : undefined}
            aria-errormessage={errorMessage ? `${props.id}-input__error-message` : undefined}
            aria-invalid={errorMessage ? 'true' : undefined}
            className={`usa-input usa-tooltip ${props.className ?? ''}`}
            data-position={props.position ?? 'right'}
            data-testid={props.id}
            disabled={inputDisabled}
            onChange={handleOnChange}
            onFocus={handleFocus}
            ref={inputRef}
            value={inputValue}
          />
          {includeClearButton && !inputDisabled && inputValue.length > 0 && (
            <div className="usa-input-suffix">
              <Button
                aria-label="clear text input."
                id={`clear-${props.id}`}
                onClick={clearValue}
                uswdsStyle={UswdsButtonStyle.Unstyled}
              >
                <Icon name="close"></Icon>
              </Button>
            </div>
          )}
          {!includeClearButton && props.icon && (
            <div aria-hidden="true" className="usa-input-prefix">
              <Icon focusable={false} name={props.icon}></Icon>
            </div>
          )}
        </div>
        {errorMessage && errorMessage.length > 0 && (
          <div className="usa-input__error-message" id={`${props.id}-input__error-message`}>
            {errorMessage}
          </div>
        )}
      </div>
    </>
  );
}

const Input = forwardRef(InputComponent);
export default Input;
