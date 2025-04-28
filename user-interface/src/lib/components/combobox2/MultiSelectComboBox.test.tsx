import {describe} from "vitest";
import {ComboOption, State, StateMachine} from "@/lib/components/combobox2/MultiSelectComboBox";

const OPTION_A: ComboOption = {
  value: 'value_A',
  label: 'label_A',
}
const OPTION_B: ComboOption = {
  value: 'value_B',
  label: 'label_B',
}
const OPTION_C: ComboOption = {
  value: 'value_C',
  label: 'label_C',
}
const OPTION_D: ComboOption = {
  value: 'value_D',
  label: 'label_D',
}

describe('MultiSelectComboBox', () => {
  describe('state machine', () => {
    test('should enable', () => {
      const initialState: State = {
        _name: 'DISABLED',
        disabled: true,
        options: [],
        selected: [],
      }
      const newState = StateMachine.transition(initialState, {_name: 'ENABLE'})
      expect(newState.disabled).toBeFalsy();
      expect(newState._name).toBe('ENABLED');
    });

    test('should disable', () => {
      const initialState: State = {
        _name: 'ENABLED',
        disabled: false,
        options: [],
        selected: [],
      }
      const newState = StateMachine.transition(initialState, {_name: 'DISABLE'})
      expect(newState.disabled).toBeTruthy();
      expect(newState._name).toBe('DISABLED');
    });

    test('should select option', () => {
      const initialState: State = {
        _name: 'ENABLED',
        disabled: false,
        options: [OPTION_A, OPTION_B],
        selected: [],
      }
      const newState = StateMachine.transition(initialState, {
        _name: 'SELECT_OPTION',
        option: OPTION_C
      })
      expect(newState.selected).toContain(OPTION_C);
    });

    test('should deselect option', () => {
      const initialState: State = {
        _name: 'ENABLED',
        disabled: false,
        options: [OPTION_A, OPTION_B],
        selected: ['Option 1'],
      }
      const newState = StateMachine.transition(initialState, {
        _name: 'SELECT_OPTION',
        option: OPTION_A
      })
      expect(newState.selected).not.toContain(OPTION_A);
    });

    test('should set options', () => {
      const initialState: State = {
        _name: 'ENABLED',
        disabled: false,
        options: [OPTION_A],
        selected: [],
      }
      const newOptions = [OPTION_B, OPTION_C];
      const newState = StateMachine.transition(initialState, {
        _name: 'SET_OPTIONS',
        options: newOptions
      })
      expect(newState.options).toEqual(newOptions);
    });

    test('should handle invalid transitions', () => {
      const initialState: State = {
        _name: 'DISABLED',
        disabled: true,
        options: [],
        selected: [],
      }
      const newState = StateMachine.transition(initialState, {_name: 'SELECT_OPTION', option: OPTION_A})
      expect(newState).toEqual(initialState);
    });
  });
});