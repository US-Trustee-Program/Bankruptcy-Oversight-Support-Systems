import Button, { UswdsButtonStyle } from './Button';
import './forms.scss';
import './Checkbox.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

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

function Checkbox_(props: CheckboxProps, ref: React.Ref<CheckboxRef>) {
  const [isChecked, setIsChecked] = useState<boolean>(props.checked ?? false);
  const [indeterminateState, setIndeterminateState] = useState<boolean>(false);
  const realCheckboxRef = useRef<HTMLInputElement>(null);

  const checkHandler = (
    ev: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    // Ignore keyboard-initiated native clicks; we handle keyboard toggling explicitly in keyUpHandler
    if ('button' in ev && ev.detail === 0) {
      return;
    }

    if (props.onChange) {
      const syntheticEvent = {
        target: realCheckboxRef.current,
        currentTarget: realCheckboxRef.current,
      } as React.ChangeEvent<HTMLInputElement>;

      syntheticEvent.target.checked = !isChecked;

      props.onChange(syntheticEvent);
    }

    setIsChecked(!isChecked);
  };

  const keyDownHandler = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    if (ev.key === ' ' || ev.key === 'Enter') {
      // Prevent page scroll / default button behavior, but do not toggle yet
      ev.preventDefault();
    }
  };

  const keyUpHandler = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      checkHandler(ev);
    }
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
    } else if (value === CheckboxState.CHECKED) {
      setIsChecked(true);
    } else if (value === CheckboxState.UNCHECKED) {
      setIsChecked(false);
    } else if (value === CheckboxState.INDETERMINATE) {
      setIsChecked(false);
      indeterminate = true;
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
  const labelTestId = `${checkboxTestId}-click-target`;
  return (
    <div className={`usa-form-group usa-checkbox ${props.className ?? ''}`}>
      <input
        type="checkbox"
        data-testid={checkboxTestId}
        id={checkboxTestId}
        className="usa-checkbox__input"
        ref={realCheckboxRef}
        name={props.name ?? ''}
        value={props.value}
        checked={isChecked}
        onChange={() => {}}
        onFocus={focusHandler}
        data-indeterminate={indeterminateState || null}
        required={props.required}
        disabled={props.disabled}
        tabIndex={-1}
      />
      <label htmlFor={checkboxTestId}>
        <Button
          id={labelTestId}
          className={`usa-checkbox__label ${UswdsButtonStyle.Unstyled}`}
          onClick={checkHandler}
          onKeyDown={keyDownHandler}
          onKeyUp={keyUpHandler}
          title={props.title}
          aria-label={props.label || `check ${props.value}`}
          role="checkbox"
          aria-checked={isChecked}
        >
          {props.label ?? <>&nbsp;</>}
        </Button>
      </label>
    </div>
  );
}

const Checkbox = forwardRef(Checkbox_);
export default Checkbox;
