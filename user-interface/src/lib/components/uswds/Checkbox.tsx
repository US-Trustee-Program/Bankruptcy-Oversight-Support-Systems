import Button, { UswdsButtonStyle } from './Button';
import './forms.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export enum CheckboxState {
  UNCHECKED = -1,
  INDETERMINATE = 0,
  CHECKED = 1,
}

export interface CheckboxProps {
  id: string;
  label?: string;
  name?: string;
  value: string | number;
  title?: string;
  checked?: boolean;
  onChange?: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface CheckboxRef {
  setChecked: (value: boolean | CheckboxState) => void;
  getLabel: () => string;
}

const CheckboxComponent = (props: CheckboxProps, ref: React.Ref<CheckboxRef>) => {
  const [isChecked, setIsChecked] = useState<boolean>(props.checked ?? false);
  const [indeterminateState, setIndeterminateState] = useState<boolean>(false);

  const checkHandler = (_ev: React.MouseEvent<HTMLButtonElement>) => {
    if (props.onChange) {
      const syntheticEvent = {
        target: {
          checked: !isChecked,
        },
      } as React.ChangeEvent<HTMLInputElement>;
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
      setChecked,
      getLabel,
    }),
    [],
  );
  const checkboxTestId = `checkbox-${props.id}`;
  const labelTestId = `checkbox-label-${props.id}`;
  return (
    <div className={`usa-form-group usa-checkbox ${props.className ?? ''}`}>
      <label htmlFor={props.id} data-testid={labelTestId}>
        <Button
          className={`usa-checkbox__label ${UswdsButtonStyle.Unstyled}`}
          onClick={checkHandler}
        >
          {props.label}
        </Button>
      </label>
      <input
        type="checkbox"
        data-testid={checkboxTestId}
        id={props.id}
        className="usa-checkbox__input"
        name={props.name ?? ''}
        value={props.value}
        aria-label={props.label ?? `check ${props.value}`}
        checked={isChecked}
        onChange={() => {}}
        onFocus={focusHandler}
        data-indeterminate={indeterminateState || null}
        title={props.title}
        required={props.required}
        disabled={props.disabled}
        tabIndex={-1}
      />
    </div>
  );
};

const Checkbox = forwardRef(CheckboxComponent);

export default Checkbox;
