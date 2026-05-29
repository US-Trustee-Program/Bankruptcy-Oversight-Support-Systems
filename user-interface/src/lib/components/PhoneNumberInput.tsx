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

  function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const inputElement = ev.target;
    const cursorPosition = inputElement.selectionStart ?? 0;
    const digitsBeforeCursor = inputElement.value
      .slice(0, cursorPosition)
      .replace(/\D/g, '').length;

    const { formattedPhoneNumber } = validatePhoneNumberInputEvent(ev);
    forwardedRef?.current?.setValue(formattedPhoneNumber);
    ev.target.value = formattedPhoneNumber;

    const newCursorPosition = calculateCursorPosition(formattedPhoneNumber, digitsBeforeCursor);
    setTimeout(() => {
      if (typeof inputElement.setSelectionRange === 'function') {
        inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);

    onChange?.(ev);
  }

  function calculateCursorPosition(formatted: string, digitsBeforeCursor: number): number {
    if (digitsBeforeCursor === 0) return 0;
    for (let i = 0, digitCount = 0; i < formatted.length; i++) {
      if (!/\d/.test(formatted[i])) continue;
      digitCount++;
      if (digitCount === digitsBeforeCursor) return i + 1;
    }
    return formatted.length;
  }

  return (
    <Input
      {...otherProps}
      ref={forwardedRef}
      onChange={handleChange}
      ariaDescription={props.ariaDescription || 'Example: 123-456-7890'}
      type="tel"
      inputMode="numeric"
    ></Input>
  );
}

const PhoneNumberInput = forwardRef(PhoneNumberInput_);
export default PhoneNumberInput;
