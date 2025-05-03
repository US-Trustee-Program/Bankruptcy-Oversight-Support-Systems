import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import './forms.scss';
import Button, { UswdsButtonStyle } from './Button';

export enum CheckboxState {
  CHECKED = 1,
  INDETERMINATE = 0,
  UNCHECKED = -1,
}

export interface CheckboxProps {
  checked?: boolean;
  className?: string;
  disabled?: boolean;
  id: string;
  label?: string;
  name?: string;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  required?: boolean;
  title?: string;
  value: number | string;
}

export interface CheckboxRef {
  getLabel: () => string;
  setChecked: (value: boolean | CheckboxState) => void;
}

const CheckboxComponent = (props: CheckboxProps, ref: React.Ref<CheckboxRef>) => {
  const [isChecked, setIsChecked] = useState<boolean>(props.checked ?? false);
  const [indeterminateState, setIndeterminateState] = useState<boolean>(false);
  const realCheckboxRef = useRef<HTMLInputElement>(null);

  const checkHandler = (_ev: React.MouseEvent<HTMLButtonElement>) => {
    if (props.onChange) {
      const syntheticEvent = {
        currentTarget: realCheckboxRef.current,
        target: realCheckboxRef.current,
      } as React.ChangeEvent<HTMLInputElement>;

      syntheticEvent.target.checked = !isChecked;

      props.onChange(syntheticEvent);
    }

    setIsChecked(!isChecked);
  };

  const focusHandler = (ev: React.FocusEvent<HTMLElement>) => {
    if (props.onFocus) {
      props.onFocus(ev);
    }
  };

  function getLabel() {
    return props.label ?? '';
  }

  function setChecked(value: boolean | CheckboxState) {
    let indeterminate = false;
    if (value === true || value === false) {
      setIsChecked(value);
    } else {
      if (value === CheckboxState.CHECKED) {
        setIsChecked(true);
      } else if (value === CheckboxState.UNCHECKED) {
        setIsChecked(false);
      } else if (value === CheckboxState.INDETERMINATE) {
        setIsChecked(false);
        indeterminate = true;
      }
    }
    setIndeterminateState(indeterminate);
  }

  useEffect(() => {
    // initializing isChecked above as a default doesn't work for some reason.
    setIsChecked(props.checked ?? false);
  }, [props.checked]);

  useImperativeHandle(
    ref,
    () => ({
      getLabel,
      setChecked,
    }),
    [],
  );
  const checkboxTestId = `checkbox-${props.id}`;
  const labelTestId = `${checkboxTestId}-click-target`;
  return (
    <div className={`usa-form-group usa-checkbox ${props.className ?? ''}`}>
      <input
        aria-label={props.label ?? `check ${props.value}`}
        checked={isChecked}
        className="usa-checkbox__input"
        data-indeterminate={indeterminateState || null}
        data-testid={checkboxTestId}
        disabled={props.disabled}
        id={checkboxTestId}
        name={props.name ?? ''}
        onChange={() => {}}
        onFocus={focusHandler}
        ref={realCheckboxRef}
        required={props.required}
        tabIndex={-1}
        title={props.title}
        type="checkbox"
        value={props.value}
      />
      <label htmlFor={checkboxTestId}>
        <Button
          className={`usa-checkbox__label ${UswdsButtonStyle.Unstyled}`}
          id={labelTestId}
          onClick={checkHandler}
          title={props.title}
        >
          {props.label ?? <>&nbsp;</>}
        </Button>
      </label>
    </div>
  );
};

const Checkbox = forwardRef(CheckboxComponent);

export default Checkbox;
