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

const hasAriaDescription = (ariaDescription?: string | string[]) =>
  !!ariaDescription && (!Array.isArray(ariaDescription) || ariaDescription.length > 0);

// Tracks whether a field has been announced as invalid so we only re-announce
// on transitions: unknown→invalid, invalid→valid, valid→invalid.
type ValidationState = 'unknown' | 'invalid' | 'valid';

function Input_(props: InputProps, ref: React.Ref<InputRef>) {
  const [inputValue, setInputValue] = useState<string>(props.value ?? '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

  const { includeClearButton, label, ariaDescription, errorMessage, required, ...otherProps } =
    props;

  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const baseId = props.id ?? generatedId;
  const hintId = `input-hint-${baseId}`;

  // Live region text — changing this string is what the AT announces.
  // We only update it on state transitions so the text always genuinely changes,
  // which is the reliable trigger for AT announcement.
  const [liveText, setLiveText] = useState('');
  const validationStateRef = useRef<ValidationState>('unknown');
  const debounceIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Ref so handleBlur always reads the latest errorMessage, not a stale closure.
  const errorMessageRef = useRef(errorMessage);
  errorMessageRef.current = errorMessage;

  function announceInvalid(message: string) {
    if (validationStateRef.current !== 'invalid') {
      validationStateRef.current = 'invalid';
      setLiveText(`Invalid: ${message}`);
    }
  }

  function announceValid() {
    if (validationStateRef.current === 'invalid') {
      validationStateRef.current = 'valid';
      setLiveText('Valid');
    }
  }

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

  function handleBlur() {
    clearTimeout(debounceIdRef.current);
    const msg = errorMessageRef.current;
    if (msg) {
      announceInvalid(msg);
    } else {
      announceValid();
    }
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

  // Debounced transition announcements while typing.
  // Only fires when the validation state actually changes so the live text
  // always transitions to a different string — reliably triggering the AT.
  useEffect(() => {
    debounceIdRef.current = setTimeout(() => {
      if (errorMessage) {
        announceInvalid(errorMessage);
      } else {
        announceValid();
      }
    }, 400);
    return () => clearTimeout(debounceIdRef.current);
  }, [errorMessage, inputValue]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable, focus }));

  return (
    <div className={`usa-form-group ${props.className ?? ''}`}>
      <label className="usa-label" id={baseId + '-label'} htmlFor={baseId}>
        {label}
      </label>
      {hasAriaDescription(ariaDescription) && (
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
      {/* Polite live region for validation state transitions.
          Text only changes on unknown→invalid, invalid→valid, valid→invalid
          so the AT always sees a genuine content change and announces it. */}
      <div aria-live="polite" aria-atomic="true" className="usa-sr-only">
        {liveText}
      </div>
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
          onBlur={handleBlur}
          onFocus={handleFocus}
          data-testid={baseId}
          disabled={inputDisabled}
          value={inputValue}
          aria-describedby={hasAriaDescription(ariaDescription) ? hintId : undefined}
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
