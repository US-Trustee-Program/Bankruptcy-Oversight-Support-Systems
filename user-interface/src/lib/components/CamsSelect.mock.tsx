import './CamsSelect.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import React from 'react';
import { SelectRef } from '../type-declarations/input-fields';
import { fireEvent } from '@testing-library/react';
import { SingleSelectOption } from './CamsSelect';

export interface CamsSelectProps {
  id: string;
  onChange?: (newValue: SingleSelectOption) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options: Record<string, string>[];
  label?: string;
  value?: string;
}

export function MockCamsSelectComponent(props: CamsSelectProps, ref: React.Ref<SelectRef>) {
  const [internalValue, setInternalValue] = React.useState<SingleSelectOption>(null);
  const [isDisabled, setIsDisabled] = useState<boolean>(false);

  useEffect(() => {
    if (props.value !== undefined) {
      const valueRec = props.options.find((rec) => rec.value === props.value);
      if (valueRec) {
        setInternalValue(valueRec);
      }
    }
  }, [props.value]);

  function handleOnClick(option: SingleSelectOption) {
    setInternalValue(option);
    if (props.onChange) props.onChange && props.onChange(option);
  }

  function clearValue() {
    setInternalValue(null);
  }

  function resetValue() {
    if (props.value) setValue(props.value);
    else setInternalValue(null);
  }

  function setValue(value: string) {
    const valueRec = props.options.find((rec) => rec.value === value);
    if (valueRec) setInternalValue(valueRec);
  }

  function getValue(): SingleSelectOption {
    return internalValue;
  }

  function disable(value: boolean) {
    setIsDisabled(value);
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      getValue,
      setValue,
      disable,
    };
  });

  return (
    <>
      {props.options.map((option: SingleSelectOption, idx: number) => {
        return (
          <button
            id={`select-button-${props.id}-${idx}`}
            key={idx}
            onClick={() => handleOnClick(option)}
            data-value={option}
            disabled={isDisabled}
          ></button>
        );
      })}
    </>
  );
}

const CamsSelect = forwardRef(MockCamsSelectComponent);
export default CamsSelect;

export function selectItemInMockSelect(id: string, index: number) {
  const selectButton = document.querySelector(`#select-button-${id}-${index}`);
  expect(selectButton).toBeInTheDocument();
  fireEvent.click(selectButton!);
  return selectButton;
}
