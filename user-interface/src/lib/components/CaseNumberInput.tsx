import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { InputRef } from '../type-declarations/input-fields';
import Input, { InputProps } from './uswds/Input';

type CaseNumberInputProps = Omit<InputProps, 'onChange' | 'onFocus'> & {
  allowEnterKey?: boolean;
  allowPartialCaseNumber?: boolean;
  onChange: (caseNumber?: string) => void;
  onDisable?: () => void;
  onEnable?: () => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
};

export function validateCaseNumberInput(ev: React.ChangeEvent<HTMLInputElement>) {
  const allowedCharsPattern = /[0-9]/g;
  const filteredInput = ev.target.value.match(allowedCharsPattern) ?? [];
  if (filteredInput.length > 7) {
    filteredInput.splice(7);
  }
  if (filteredInput.length > 2) {
    filteredInput.splice(2, 0, '-');
  }
  const joinedInput = filteredInput?.join('') || '';
  const caseNumberPattern = /^\d{2}-\d{5}$/;
  const caseNumber = caseNumberPattern.test(joinedInput) ? joinedInput : undefined;
  return { caseNumber, joinedInput };
}

function CaseNumberInputComponent(props: CaseNumberInputProps, ref: React.Ref<InputRef>) {
  const {
    allowEnterKey,
    allowPartialCaseNumber,
    onChange,
    onDisable,
    onEnable,
    onFocus,
    ...otherProps
  } = props;
  const [isDisabled, setIsDisabled] = useState<boolean>(false);
  const forwardedRef = useRef<InputRef>(null);

  function getValue() {
    return forwardedRef.current?.getValue() ?? '';
  }

  function resetValue() {
    return forwardedRef.current?.setValue(props.value ?? '');
  }

  function clearValue() {
    return forwardedRef.current?.clearValue();
  }

  function setValue(value: string) {
    return forwardedRef.current?.setValue(value);
  }

  function disable(value: boolean) {
    setTimeout(() => {
      setIsDisabled(value);
    }, 100);

    return forwardedRef.current?.disable(value);
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { caseNumber, joinedInput } = validateCaseNumberInput(ev);
    forwardedRef?.current?.setValue(joinedInput);

    if (allowPartialCaseNumber) {
      onChange(joinedInput);
    } else {
      onChange(caseNumber);
    }
  }

  function handleEnter(ev: React.KeyboardEvent) {
    if (
      allowEnterKey &&
      ev.key === 'Enter' &&
      forwardedRef.current &&
      forwardedRef.current?.getValue().length > 0
    ) {
      onChange(forwardedRef.current?.getValue());
    }
  }

  function handleOnFocus(ev: React.FocusEvent<HTMLElement>) {
    if (onFocus) onFocus(ev);
  }

  function focus() {
    forwardedRef?.current?.focus();
  }

  useImperativeHandle(ref, () => ({ clearValue, disable, focus, getValue, resetValue, setValue }));

  useEffect(() => {
    if (isDisabled && onDisable) {
      onDisable();
    } else if (!isDisabled && onEnable) {
      onEnable();
    }
  }, [isDisabled]);

  return (
    <Input
      {...otherProps}
      aria-placeholder=""
      ariaDescription="For example, 12-34567"
      includeClearButton={true}
      onChange={handleOnChange}
      onFocus={handleOnFocus}
      onKeyDown={handleEnter}
      placeholder="__-_____"
      ref={forwardedRef}
    ></Input>
  );
}

const CaseNumberInput = forwardRef(CaseNumberInputComponent);
export default CaseNumberInput;
