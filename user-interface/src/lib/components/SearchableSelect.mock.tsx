import React, { forwardRef, useImperativeHandle } from 'react';
import { SearchableSelectOption, SearchableSelectProps } from './SearchableSelect';
import { InputRef } from '../type-declarations/input-fields';

function SearchableSelectComponentMock(props: SearchableSelectProps, ref: React.Ref<InputRef>) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event?.target.value;

    if (value.length > 0 && props.options?.length) {
      const option: SearchableSelectOption = props.options[1];
      const transformedValue = {
        label: option?.label,
        value: option?.value,
      };

      props.onChange?.(transformedValue);
    } else {
      props.onChange?.({
        label: '',
        value: '',
      });
    }
  }

  function clearValue() {}
  function resetValue() {}
  function setValue() {}

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
    };
  });

  return <input id={props.id} className="new-court__select" onChange={handleChange}></input>;
}

const SearchableSelectMock = forwardRef(SearchableSelectComponentMock);
export default SearchableSelectMock;
