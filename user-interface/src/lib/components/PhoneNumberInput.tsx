import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Input, { InputProps } from './uswds/Input';
import { InputRef } from '../type-declarations/input-fields';

export function validatePhoneNumberInput(ev: React.ChangeEvent<HTMLInputElement>) {
  const digitsOnly = (ev.target.value.match(/\d/g) ?? []).slice(0, 10);

  let joinedInput = '';
  const len = digitsOnly.length;
  if (len > 0) {
    joinedInput = digitsOnly.slice(0, Math.min(3, len)).join('');
  }
  if (len >= 4) {
    joinedInput += '-' + digitsOnly.slice(3, Math.min(6, len)).join('');
  }
  if (len >= 7) {
    joinedInput += '-' + digitsOnly.slice(6, 10).join('');
  }

  if (len === 0) {
    joinedInput = '';
  }

  const fullPhonePattern = /^\d{3}-\d{3}-\d{4}$/;
  const phoneNumber = fullPhonePattern.test(joinedInput) ? joinedInput : undefined;
  return { phoneNumber, joinedInput };
}

type PhoneNumberInputProps = Omit<InputProps, 'onChange' | 'onFocus'> & {
  onChange: (phoneNumber?: string) => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
};

function PhoneNumberInputComponent(props: PhoneNumberInputProps, ref: React.Ref<InputRef>) {
  const { onChange, ...otherProps } = props;

  const forwardedRef = useRef<InputRef>(null);
  const clearValue = () => forwardedRef.current?.clearValue();
  const resetValue = () => forwardedRef.current?.resetValue();
  const setValue = (value: string) => forwardedRef.current?.setValue(value);
  const getValue = () => forwardedRef.current?.getValue() ?? '';
  const disable = (value: boolean) => forwardedRef.current?.disable(value);
  const focus = () => forwardedRef.current?.focus();

  useImperativeHandle(ref, () => ({
    clearValue,
    resetValue,
    setValue,
    getValue,
    disable,
    focus,
  }));

  return (
    <Input
      {...otherProps}
      ref={forwardedRef}
      onChange={(ev) => {
        const { phoneNumber, joinedInput } = validatePhoneNumberInput(ev);
        forwardedRef?.current?.setValue(joinedInput);
        onChange(phoneNumber);
      }}
      includeClearButton={true}
      ariaDescription="Example: 123-456-7890"
      placeholder="___-___-____"
      aria-placeholder=""
      type="tel"
      inputMode="numeric"
    ></Input>
  );
}

const PhoneNumberInput = forwardRef(PhoneNumberInputComponent);
export default PhoneNumberInput;
