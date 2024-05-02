import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
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
};

function CaseNumberInputComponent(props: CaseNumberInputProps, ref: React.Ref<InputRef>) {
  const [enteredCaseNumber, setEnteredCaseNumber] = useState<string>('');
  const forwardedRef = useRef<InputRef>(null);

  function getValue() {
    return forwardedRef.current?.getValue() ?? '';
  }

  function resetValue() {
    return forwardedRef.current?.setValue(props.value || '');
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
    if (caseNumber) {
      setEnteredCaseNumber(caseNumber);
    } else {
      setEnteredCaseNumber(joinedInput);
    }
    props.onChange(caseNumber);
  }

  function handleKeyDown(ev: React.KeyboardEvent) {
    if (props.allowEnterKey === true && ev.key === 'Enter' && enteredCaseNumber.length > 0) {
      props.onChange(enteredCaseNumber);
    }
  }

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable }));

  return (
    <Input
      {...props}
      ref={forwardedRef}
      onChange={handleOnChange}
      onKeyDown={handleKeyDown}
      includeClearButton={true}
    ></Input>
  );
}

const CaseNumberInput = forwardRef(CaseNumberInputComponent);
export default CaseNumberInput;
