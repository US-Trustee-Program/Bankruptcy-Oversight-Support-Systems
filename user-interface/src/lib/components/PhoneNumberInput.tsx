import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Input, { InputProps } from './uswds/Input';
import { InputRef } from '../type-declarations/input-fields';
import { PHONE_REGEX } from '@common/cams/regex';

export function validatePhoneNumberInputEvent(ev: React.ChangeEvent<HTMLInputElement>) {
  return validatePhoneNumberInput(ev.target.value);
}

function validatePhoneNumberInput(value: string) {
  const digitsOnly = (value.match(/\d/g) ?? []).slice(0, 10);

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

  const phoneNumber = PHONE_REGEX.test(joinedInput) ? joinedInput : undefined;
  return { phoneNumber, joinedInput };
}

type PhoneNumberInputProps = Omit<InputProps, 'onFocus'> & {
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
};

function PhoneNumberInputComponent(props: PhoneNumberInputProps, ref: React.Ref<InputRef>) {
  const { onChange, ...otherProps } = props;

  const forwardedRef = useRef<InputRef>(null);
  useImperativeHandle(
    ref,
    () => ({
      setValue: (value: string) => {
        const { joinedInput } = validatePhoneNumberInput(value);
        forwardedRef.current?.setValue(joinedInput);
      },
      clearValue: () => forwardedRef.current?.clearValue(),
      resetValue: () => forwardedRef.current?.resetValue(),
      getValue: () => forwardedRef.current?.getValue() ?? '',
      disable: (value: boolean) => forwardedRef.current?.disable(value),
      focus: () => forwardedRef.current?.focus(),
    }),
    [],
  );

  return (
    <Input
      {...otherProps}
      ref={forwardedRef}
      onChange={(ev) => {
        const { joinedInput } = validatePhoneNumberInputEvent(ev);
        forwardedRef?.current?.setValue(joinedInput);
        ev.target.value = joinedInput;
        props.onChange?.(ev);
      }}
      includeClearButton={true}
      ariaDescription="Example: 123-456-7890"
      type="tel"
      inputMode="numeric"
    ></Input>
  );
}

const PhoneNumberInput = forwardRef(PhoneNumberInputComponent);
export default PhoneNumberInput;
