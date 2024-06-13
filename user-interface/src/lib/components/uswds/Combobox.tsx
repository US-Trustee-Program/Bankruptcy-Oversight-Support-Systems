import './forms.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { InputRef } from '../../type-declarations/input-fields';
import Icon from './Icon';
import Button, { UswdsButtonStyle } from './Button';

// Alias for readability.
//const debounce = setTimeout;

type ComboOptions = {
  value: string | number | object;
  label: string;
};

export type ComboboxProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] & {
    label?: string;
    autoComplete?: 'off';
    position?: 'left' | 'right';
    value?: string;
    icon?: string;
    includeClearButton?: boolean;
    options: ComboOptions[];
  };

function ComboboxComponent(props: ComboboxProps, ref: React.Ref<InputRef>) {
  const { label, includeClearButton, options, value, ...otherProps } = props;
  const [inputValue, setInputValue] = useState<string>(value || '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled ?? false);

  function emitChange(value: string) {
    if (otherProps.onChange) {
      const ev = { target: { value } } as React.ChangeEvent<HTMLInputElement>;
      otherProps.onChange(ev);
    }
  }

  function getValue() {
    return inputValue;
  }

  function resetValue() {
    setInputValue(value || '');
  }

  function clearValue() {
    setInputValue('');
    emitChange('');
  }

  function setValue(value: string) {
    setInputValue(value);
  }

  function disable(value: boolean) {
    setInputDisabled(value);
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(ev.target.value);
    if (otherProps.onChange) {
      otherProps.onChange(ev);
    }
  }

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <div className="usa-form-group">
      <label className="usa-label" id={props.id + '-label'} htmlFor={props.id}>
        {label}
      </label>
      <div className="usa-combo-box">
        {includeClearButton && !inputDisabled && (
          <div className="usa-input-suffix" aria-hidden="true">
            <Button uswdsStyle={UswdsButtonStyle.Unstyled} onClick={clearValue}>
              <Icon name="close"></Icon>
            </Button>
          </div>
        )}
        <div
          className="usa-select usa-combo-box__select"
          id={`${props.id}-item-list`}
          aria-hidden="true"
          tabIndex={-1}
        >
          <ul>
            {options.map((option, idx) => (
              <li key={idx} data-value={option.value}>
                {option.label}
              </li>
            ))}
          </ul>
        </div>

        <input
          {...otherProps}
          className={`usa-input usa-tooltip ${props.className ?? ''}`}
          data-position={props.position ?? 'right'}
          onChange={handleOnChange}
          data-testid={props.id}
          disabled={inputDisabled}
          value={inputValue}
        />
      </div>
    </div>
  );
}

const Combobox = forwardRef(ComboboxComponent);
export default Combobox;
