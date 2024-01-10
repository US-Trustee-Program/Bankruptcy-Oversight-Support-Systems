import React, { forwardRef, useImperativeHandle } from 'react';
import { SearchableSelectProps } from './SearchableSelect';
import { InputRef } from '../type-declarations/input-fields';

function SearchableSelectComponentMock(props: SearchableSelectProps, ref: React.Ref<InputRef>) {
  function handleChange() {
    const option: Record<string, string> = (props.options as Array<Record<string, string>>)[0];
    return {
      label: option.courtDivisionName,
      value: option.divisionCode,
    };
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

  return <input id={props.id} className="new-court__select" onChange={() => handleChange}></input>;
}

const SearchableSelectMock = forwardRef(SearchableSelectComponentMock);
export default SearchableSelectMock;
