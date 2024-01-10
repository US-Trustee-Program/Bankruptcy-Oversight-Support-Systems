/* eslint-disable @typescript-eslint/no-explicit-any */
// refactor - let's find a way to avoid using any
import './SearchableSelect.scss';
import ReactSelect, { SingleValue } from 'react-select';
import { forwardRef, useImperativeHandle } from 'react';
import React from 'react';
import { InputRef } from '../type-declarations/input-fields';

export type SearchableSelectOption = SingleValue<Record<string, string>>;

export interface SearchableSelectProps {
  onChange: (newValue: SearchableSelectOption) => void;
  className?: string;
  closeMenuOnSelect?: boolean;
  options?: Record<string, string>[];
  label: string;
  id: string;
}

function SearchableSelectComponent(props: SearchableSelectProps, ref: React.Ref<InputRef>) {
  const searchableSelectRef = React.useRef(null);
  const customStyles = {
    control: (provided: any, state: { isFocused: any }) => ({
      ...provided,
      background: '#fff',
      borderColor: '#565c65',
      minHeight: '40px',
      boxShadow: state.isFocused ? null : null,
      outline: state.isFocused ? '0.25rem solid #2491ff' : null,
      borderRadius: 0,
      '&:hover': {
        borderColor: '#565c65',
      },
    }),

    placeholder: (provided: any) => ({
      ...provided,
      color: '#565C65',
    }),

    valueContainer: (provided: any) => ({
      ...provided,
      padding: '0 6px',
    }),

    input: (provided: any) => ({
      ...provided,
      margin: '0px',
    }),

    indicatorSeparator: () => ({
      display: 'none',
    }),

    indicatorsContainer: (provided: any) => ({
      ...provided,
      height: '40px',
    }),

    clearIndicator: (provided: any) => ({
      ...provided,
      color: '#1b1b1b',
    }),

    dropdownIndicator: (provided: any) => ({
      ...provided,
      color: '#1b1b1b',
    }),

    multiValueLabel: (provided: any) => ({
      ...provided,
      color: '#1b1b1b',
    }),
  };

  function clearValue() {
    if (searchableSelectRef.current && Object.hasOwn(searchableSelectRef.current, 'clearValue')) {
      (searchableSelectRef.current as InputRef).clearValue();
    }
  }

  function resetValue() {
    throw new Error('Not implemented');
  }

  function setValue() {
    throw new Error('Not implemented');
  }

  useImperativeHandle(ref, () => {
    return {
      clearValue,
      resetValue,
      setValue,
    };
  });

  return (
    <ReactSelect
      aria-label={props.label}
      options={props.options}
      closeMenuOnSelect={props.closeMenuOnSelect}
      onChange={props.onChange}
      className={`${props.className || ''} cams-searchable-select`}
      styles={customStyles}
      id={props.id}
      data-testid={props.id}
      ref={searchableSelectRef}
      isSearchable={true}
    ></ReactSelect>
  );
}

const SearchableSelect = forwardRef(SearchableSelectComponent);
export default SearchableSelect;
