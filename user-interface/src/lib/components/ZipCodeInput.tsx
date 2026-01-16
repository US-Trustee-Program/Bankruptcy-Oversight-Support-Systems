import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Input, { InputProps } from './uswds/Input';
import { InputRef } from '../type-declarations/input-fields';

export function validateZipCodeInputEvent(ev: React.ChangeEvent<HTMLInputElement>) {
  return formatZipCodeInput(ev.target.value);
}

export function formatZipCodeInput(value: string) {
  const digits = (value.match(/\d/g) ?? []).slice(0, 9).join('');

  let formattedZipCode = '';
  if (digits.length === 0) {
    formattedZipCode = '';
  } else if (digits.length <= 5) {
    formattedZipCode = digits;
  } else {
    const first = digits.slice(0, 5);
    const rest = digits.slice(5);
    formattedZipCode = `${first}-${rest}`;
  }

  return { formattedZipCode };
}

type ZipCodeInputProps = Omit<InputProps, 'onFocus'> & {
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
};

function ZipCodeInput_(props: ZipCodeInputProps, ref: React.Ref<InputRef>) {
  const { onChange, ...otherProps } = props;

  const forwardedRef = useRef<InputRef>(null);
  useImperativeHandle(
    ref,
    () => ({
      setValue: (value: string) => {
        const { formattedZipCode } = formatZipCodeInput(value);
        forwardedRef.current?.setValue(formattedZipCode);
      },
      clearValue: () => forwardedRef.current?.clearValue(),
      resetValue: () => forwardedRef.current?.resetValue(),
      getValue: () => forwardedRef.current?.getValue() ?? '',
      disable: (value: boolean) => forwardedRef.current?.disable(value),
      focus: () => forwardedRef.current?.focus(),
    }),
    [],
  );

  const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const { formattedZipCode } = validateZipCodeInputEvent(ev);
    forwardedRef?.current?.setValue(formattedZipCode);
    ev.target.value = formattedZipCode;
    props.onChange?.(ev);
  };

  return (
    <Input
      {...otherProps}
      ref={forwardedRef}
      onChange={handleChange}
      ariaDescription={props.ariaDescription || 'Example: 12345 or 12345-6789'}
      type="text"
      inputMode="numeric"
    ></Input>
  );
}

const ZipCodeInput = forwardRef(ZipCodeInput_);
export default ZipCodeInput;
