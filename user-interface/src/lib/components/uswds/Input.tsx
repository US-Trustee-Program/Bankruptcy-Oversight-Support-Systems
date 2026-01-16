import './forms.scss';
import './Input.scss';
import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type JSX,
} from 'react';
import { InputRef } from '../../type-declarations/input-fields';
import Icon from './Icon';
import Button, { UswdsButtonStyle } from './Button';

export type InputProps = Omit<JSX.IntrinsicElements['input'], 'onFocus'> & {
  label?: string;
  autoComplete?: 'off';
  position?: 'left' | 'right';
  value?: string;
  icon?: string;
  includeClearButton?: boolean;
  ariaDescription?: string | string[];
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  errorMessage?: string;
};

function Input_(props: InputProps, ref: React.Ref<InputRef>) {
  //condition for check for title to style tooltip
  const [inputValue, setInputValue] = useState<string>(props.value ?? '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

  const { includeClearButton, label, ariaDescription, errorMessage, required, ...otherProps } =
    props;

  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const baseId = props.id ?? generatedId;
  const hintId = `input-hint-${baseId}`;

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
    setInputValue(props.value ?? '');
  }

  function clearValue() {
    setInputValue('');
    emitChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function setValue(value: string) {
    setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
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
    setInputValue(props.value ?? '');
  }, [props.value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable, focus }));

  return (
    <div className={`usa-form-group ${props.className ?? ''}`}>
      <label className="usa-label" id={baseId + '-label'} htmlFor={baseId}>
        {label}
      </label>
      {ariaDescription && (Array.isArray(ariaDescription) ? ariaDescription.length > 0 : true) && (
        <div className="usa-hint" id={hintId}>
          {Array.isArray(ariaDescription)
            ? ariaDescription.map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < ariaDescription.length - 1 && <br />}
                </React.Fragment>
              ))
            : ariaDescription}
        </div>
      )}
      <div
        className={`usa-input-group ${errorMessage && errorMessage.length > 0 ? 'usa-input-group--error' : ''}`}
      >
        <input
          {...otherProps}
          id={baseId}
          required={required}
          className={`usa-input usa-tooltip ${props.className ?? ''}`}
          aria-invalid={errorMessage && errorMessage.length > 0 ? 'true' : undefined}
          aria-errormessage={
            errorMessage && errorMessage.length > 0 ? `${baseId}-input__error-message` : undefined
          }
          data-position={props.position ?? 'right'}
          onChange={handleOnChange}
          onFocus={handleFocus}
          data-testid={baseId}
          disabled={inputDisabled}
          value={inputValue}
          aria-describedby={
            ariaDescription && (Array.isArray(ariaDescription) ? ariaDescription.length > 0 : true)
              ? hintId
              : undefined
          }
          ref={inputRef}
        />
        {includeClearButton && !inputDisabled && inputValue.length > 0 && (
          <div className="usa-input-suffix">
            <Button
              id={`clear-${baseId}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              onClick={clearValue}
              aria-label="clear text input."
            >
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
      {errorMessage && errorMessage.length > 0 && (
        <div id={`${baseId}-input__error-message`} className="usa-input__error-message">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

const Input = forwardRef(Input_);
export default Input;
