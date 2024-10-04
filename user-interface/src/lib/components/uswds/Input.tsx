import './forms.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { InputRef } from '../../type-declarations/input-fields';
import Icon from './Icon';
import Button, { UswdsButtonStyle } from './Button';

// Alias for readability.
//const debounce = setTimeout;

export type InputProps = Omit<JSX.IntrinsicElements['input'], 'onFocus'> & {
  label?: string;
  autoComplete?: 'off';
  position?: 'left' | 'right';
  value?: string;
  icon?: string;
  includeClearButton?: boolean;
  ariaDescription?: string;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
};

function InputComponent(props: InputProps, ref: React.Ref<InputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string>(props.value || '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

  const { includeClearButton, ariaDescription, ...otherProps } = props;

  const inputRef = useRef(null);

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

  useEffect(() => {
    setInputValue(props.value || '');
  }, [props.value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <div className="usa-form-group">
      <label className="usa-label" id={props.id + '-label'} htmlFor={props.id}>
        {props.label}
      </label>
      {ariaDescription && (
        <div className="usa-hint" id={ariaDescribedBy()}>
          {ariaDescription}
        </div>
      )}
      <div className="usa-input-group">
        <input
          {...otherProps}
          className={`usa-input usa-tooltip ${props.className ?? ''}`}
          data-position={props.position ?? 'right'}
          onChange={handleOnChange}
          onFocus={handleFocus}
          data-testid={props.id}
          disabled={inputDisabled}
          value={inputValue}
          aria-describedby={ariaDescription ? ariaDescribedBy() : undefined}
          ref={inputRef}
        />
        {includeClearButton && !inputDisabled && (
          <div className="usa-input-suffix" aria-hidden="true">
            <Button uswdsStyle={UswdsButtonStyle.Unstyled} onClick={clearValue}>
              <Icon name="close"></Icon>
            </Button>
          </div>
        )}
        {!includeClearButton && props.icon && (
          <div className="usa-input-prefix" aria-hidden="true">
            <Icon focusable={false} name={props.icon}></Icon>
          </div>
        )}
      </div>
    </div>
  );
}

const Input = forwardRef(InputComponent);
export default Input;
