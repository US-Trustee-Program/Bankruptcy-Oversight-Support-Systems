import React, { forwardRef, useState } from 'react';
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
  onChange: (caseNumber: string) => void;
  forwardedRef: React.RefObject<InputRef>;
  allowEnterKey?: boolean;
};

function CaseNumberInputComponent(props: CaseNumberInputProps, _ref: React.Ref<InputRef>) {
  const [enteredCaseNumber, setEnteredCaseNumber] = useState<string>('');

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { caseNumber, joinedInput } = validateCaseNumberInput(ev);
    props.forwardedRef?.current?.setValue(joinedInput);
    if (caseNumber) {
      setEnteredCaseNumber(caseNumber);
      props.onChange(caseNumber);
    } else {
      setEnteredCaseNumber(joinedInput);
    }
  }

  function handleKeyDown(ev: React.KeyboardEvent) {
    if (props.allowEnterKey === true && ev.key === 'Enter' && enteredCaseNumber.length > 0) {
      props.onChange(enteredCaseNumber);
    }
  }

  return (
    <Input
      {...props}
      ref={props.forwardedRef}
      onChange={handleOnChange}
      onKeyDown={handleKeyDown}
    ></Input>
  );
}

const CaseNumberInput = forwardRef(CaseNumberInputComponent);
export default CaseNumberInput;
