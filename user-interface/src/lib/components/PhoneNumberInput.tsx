import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Input, { InputProps } from './uswds/Input';
import { InputRef } from '../type-declarations/input-fields';

function validatePhoneNumberInputEvent(ev: React.ChangeEvent<HTMLInputElement>) {
  return formatPhoneNumberInput(ev.target.value);
}

function formatPhoneNumberInput(value: string) {
  const digitsOnly = (value.match(/\d/g) ?? []).slice(0, 10);

  let formattedPhoneNumber = '';
  const len = digitsOnly.length;
  if (len > 0) {
    formattedPhoneNumber = digitsOnly.slice(0, Math.min(3, len)).join('');
  }
  if (len >= 4) {
    formattedPhoneNumber += '-' + digitsOnly.slice(3, Math.min(6, len)).join('');
  }
  if (len >= 7) {
    formattedPhoneNumber += '-' + digitsOnly.slice(6, 10).join('');
  }

  if (len === 0) {
    formattedPhoneNumber = '';
  }

  return { formattedPhoneNumber };
}

type PhoneNumberInputProps = Omit<InputProps, 'onFocus'> & {
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
};

function PhoneNumberInput_(props: PhoneNumberInputProps, ref: React.Ref<InputRef>) {
  const { onChange, ...otherProps } = props;

  const forwardedRef = useRef<InputRef>(null);
  useImperativeHandle(
    ref,
    () => ({
      setValue: (value: string) => {
        const { formattedPhoneNumber } = formatPhoneNumberInput(value);
        forwardedRef.current?.setValue(formattedPhoneNumber);
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
        const { formattedPhoneNumber } = validatePhoneNumberInputEvent(ev);
        forwardedRef?.current?.setValue(formattedPhoneNumber);
        ev.target.value = formattedPhoneNumber;
        props.onChange?.(ev);
      }}
      ariaDescription={props.ariaDescription || 'Example: 123-456-7890'}
      type="tel"
      inputMode="numeric"
    ></Input>
  );
}

const PhoneNumberInput = forwardRef(PhoneNumberInput_);
export default PhoneNumberInput;
