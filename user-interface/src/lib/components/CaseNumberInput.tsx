import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Input, { InputProps } from './uswds/Input';
import { InputRef } from '../type-declarations/input-fields';

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

type CaseNumberInputProps = Omit<InputProps, 'onChange'> & {
  onChange: (caseNumber?: string) => void;
  allowEnterKey?: boolean;
  allowPartialCaseNumber?: boolean;
};

function CaseNumberInputComponent(props: CaseNumberInputProps, ref: React.Ref<InputRef>) {
  const { onChange, allowEnterKey, allowPartialCaseNumber, ...inputProps } = props;
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

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <Input
      {...inputProps}
      ref={forwardedRef}
      onChange={handleOnChange}
      onKeyDown={handleEnter}
      includeClearButton={true}
    ></Input>
  );
}

const CaseNumberInput = forwardRef(CaseNumberInputComponent);
export default CaseNumberInput;
