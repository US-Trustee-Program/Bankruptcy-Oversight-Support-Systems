import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Input, { InputProps } from './uswds/Input';
import { InputRef } from '../type-declarations/input-fields';

export function formatCaseNumberValue(value: string) {
  const allowedCharsPattern = /\d/g;
  const filteredInput = value.match(allowedCharsPattern) ?? [];

  if (filteredInput.length > 7) {
    filteredInput.splice(7);
  }
  if (filteredInput.length > 2) {
    filteredInput.splice(2, 0, '-');
  }

  const joinedInput = filteredInput.join('');
  const caseNumberPattern = /^\d{2}-\d{5}$/;
  const isValidFullCaseNumber = caseNumberPattern.test(joinedInput);

  return { joinedInput, isValidFullCaseNumber };
}

type CaseNumberInputProps = Omit<InputProps, 'onChange' | 'onFocus'> & {
  onChange: (caseNumber?: string) => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  onDisable?: () => void;
  onEnable?: () => void;
  allowEnterKey?: boolean;
  allowPartialCaseNumber?: boolean;
};

function CaseNumberInput_(props: CaseNumberInputProps, ref: React.Ref<InputRef>) {
  const {
    onChange,
    onEnable,
    onDisable,
    onFocus,
    allowEnterKey,
    allowPartialCaseNumber,
    ...otherProps
  } = props;
  const [isDisabled, setIsDisabled] = useState<boolean>(false);
  const forwardedRef = useRef<InputRef>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsDisabled(value);
      timeoutRef.current = null;
    }, 100);

    return forwardedRef.current?.disable(value);
  }

  function handleOnChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const input = ev.target as HTMLInputElement;
    const cursorPosition = input.selectionStart ?? 0;
    const previousValue = input.value;

    const { joinedInput, isValidFullCaseNumber } = formatCaseNumberValue(ev.target.value);

    forwardedRef?.current?.setValue(joinedInput);

    // Calculate new cursor position based on digits before cursor
    const digitsBeforeCursor = previousValue.slice(0, cursorPosition).replace(/\D/g, '').length;

    let newCursorPosition = 0;
    let digitCount = 0;
    for (let i = 0; i < joinedInput.length; i++) {
      if (joinedInput[i].match(/\d/)) {
        digitCount++;
        if (digitCount === digitsBeforeCursor) {
          newCursorPosition = i + 1;
          break;
        }
      }
    }

    // Restore cursor position after React updates the DOM
    setTimeout(() => {
      if (input) {
        input.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);

    const caseNumber = allowPartialCaseNumber
      ? joinedInput || undefined
      : isValidFullCaseNumber
        ? joinedInput
        : undefined;

    onChange(caseNumber);
  }

  function handleEnter(ev: React.KeyboardEvent) {
    if (
      allowEnterKey &&
      ev.key === 'Enter' &&
      forwardedRef.current &&
      forwardedRef.current.getValue().length > 0
    ) {
      const currentValue = forwardedRef.current.getValue();
      const { joinedInput, isValidFullCaseNumber } = formatCaseNumberValue(currentValue);

      const caseNumber = allowPartialCaseNumber
        ? joinedInput || undefined
        : isValidFullCaseNumber
          ? joinedInput
          : undefined;

      onChange(caseNumber);
    }
  }

  function handleOnFocus(ev: React.FocusEvent<HTMLElement>) {
    if (onFocus) {
      onFocus(ev);
    }
  }

  function focus() {
    forwardedRef?.current?.focus();
  }

  useImperativeHandle(ref, () => ({ clearValue, resetValue, setValue, getValue, disable, focus }));

  useEffect(() => {
    if (isDisabled && onDisable) {
      onDisable();
    } else if (!isDisabled && onEnable) {
      onEnable();
    }
  }, [isDisabled, onDisable, onEnable]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return (
    <Input
      {...otherProps}
      ref={forwardedRef}
      onChange={handleOnChange}
      onKeyDown={handleEnter}
      onFocus={handleOnFocus}
      includeClearButton={true}
      ariaDescription="For example, 12-34567"
      placeholder="__-_____"
      aria-placeholder=""
    ></Input>
  );
}

const CaseNumberInput = forwardRef(CaseNumberInput_);
export default CaseNumberInput;
