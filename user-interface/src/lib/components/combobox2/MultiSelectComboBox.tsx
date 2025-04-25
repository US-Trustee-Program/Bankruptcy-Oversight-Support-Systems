import '../uswds/forms.scss';
import './ComboBox.scss';
import React, {forwardRef, PropsWithChildren, useState,} from 'react';
import {ComboBoxRef} from '@/lib/type-declarations/input-fields';

export type ComboOption = {
  value: string;
  label: string;
  selected?: boolean;
  hidden?: boolean;
  divider?: boolean;
};

type StateNames = 'INITIAL' | 'NO_SELECTION' | 'HAS_SELECTION'

type Event = {
  name: 'ENABLE' | 'DISABLE' | 'CLEAR_SELECTED';
} | {
  name: 'SET_SELECTED';
  selected: string[];
} | {
  name: 'SET_OPTIONS';
  options: ComboOption[];
} | {
  name: 'SELECT_OPTION';
  option: ComboOption;
}

type State = {
  name: StateNames;
  disabled: boolean;
  options: ComboOption[];
  selected: string[];
  transition: (state: State, event: Event) => State;
}

const disable = (state: State): State => {
  return {
    ...state,
    disabled: true,
  }
}

const enable = (state: State): State => {
  return {
    ...state,
    disabled: false,
  }
}

const clearSelectedOptions = (state: State): State => {
  return {
    ...state,
    name: 'NO_SELECTION',
    selected: [],
  }
}

const selectOption = (state: State, option: ComboOption): State => {
  const selected = state.selected.includes(option.value) ? state.selected.filter((item) => item !== option.value) : [...state.selected, option.value]
  return {
    ...state,
    name: selected.length === 0 ? 'NO_SELECTION' : 'HAS_SELECTION',
    selected,
  }
}

const setOptions = (state: State, options: ComboOption[]): State => {
  return {
    ...state,
    name: 'NO_SELECTION',
    options,
    selected: [],
  }
}

const setSelected = (state: State, selected: string[]): State => {
  return {
    ...state,
    name: selected.length === 0 ? 'NO_SELECTION' : 'HAS_SELECTION',
    selected,
  }
}

type InputProps = JSX.IntrinsicElements['input'] &
  JSX.IntrinsicElements['select'] &
  PropsWithChildren;

export interface ComboBoxProps extends Omit<InputProps, 'onChange' | 'onFocus'> {
  id: string;
  label?: string;
  ariaLabelPrefix?: string;
  ariaDescription?: string;
  autoComplete?: 'off';
  icon?: string;
  options: ComboOption[];
  onUpdateSelection?: (options: ComboOption[]) => void;
  onPillSelection?: (options: ComboOption[]) => void;
  onUpdateFilter?: (value: string) => void;
  onClose?: (options: ComboOption[]) => void;
  onDisable?: () => void;
  onEnable?: () => void;
  onFocus?: (ev: React.FocusEvent<HTMLElement>) => void;
  wrapPills?: boolean;
}

function initializeState(props: ComboBoxProps): State {
  const initialState: State = {
    name: 'INITIAL',
    disabled: false,
    options: [],
    selected: [],
    transition: (state: State, event: Event): State => {
      switch (event.name) {
        case 'DISABLE':
          return disable(state);
        case "ENABLE":
          return enable(state);
        case "SET_OPTIONS":
          return setOptions(state, event.options);
        case "SELECT_OPTION":
          return selectOption(state, event.option);
        case "SET_SELECTED":
          return setSelected(state, event.selected);
        case "CLEAR_SELECTED":
          return clearSelectedOptions(state);
        default:
          return state;
      }
    },
  }
  return initialState.transition(initialState, {name: 'SET_OPTIONS', options: props.options});
}

function _MultiSelectComboBox(props: ComboBoxProps, ref: React.Ref<ComboBoxRef>) {
  const [state, setState] = useState<State>(initializeState(props));

  const handleSelectedOption = (option: ComboOption) => {
    setState(state.transition(state, {name: 'SELECT_OPTION', option}))
  }

  return <></>;
}

const MultiSelectComboBox = forwardRef(_MultiSelectComboBox);
export default MultiSelectComboBox;
