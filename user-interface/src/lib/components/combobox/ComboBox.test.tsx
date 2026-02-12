import React from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from './ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { act, render, screen, waitFor } from '@testing-library/react';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { vi } from 'vitest';

/**
 * Comprehensive ComboBox test suite
 *
 * Key improvements over original:
 * - No shared userEvent instance (each test creates its own)
 * - Helper functions don't close over stale references
 * - Clear separation of concerns by functional area
 * - Better async handling with waitFor
 */

const comboboxId = 'test-combobox';

const getDefaultOptions = (count: number = 25): ComboOption[] => {
  const options: ComboOption[] = [];
  for (let i = 0; i < count; i++) {
    options.push({
      label: 'option ' + i,
      value: 'o' + i,
    });
  }
  return options;
};

interface RenderResult {
  ref: React.RefObject<ComboBoxRef | null>;
  userEvent: ReturnType<typeof TestingUtilities.setupUserEvent>;
}

const renderWithProps = (props?: Partial<ComboBoxProps>): RenderResult => {
  const userEvent = TestingUtilities.setupUserEvent();
  const ref = React.createRef<ComboBoxRef>();
  const defaultOptions = getDefaultOptions();

  const defaultProps: ComboBoxProps = {
    id: comboboxId,
    label: 'Test Combobox',
    ariaLabelPrefix: 'test-combobox',
    options: defaultOptions,
    onUpdateSelection: () => {},
    multiSelect: true,
    singularLabel: 'thing',
    pluralLabel: 'things',
  };

  const renderProps = { ...defaultProps, ...props };
  render(
    <div>
      <button className="button1" tabIndex={0}>
        button
      </button>
      <ComboBox {...renderProps} ref={ref} />
      <input type="text" className="input1" tabIndex={0} defaultValue="Some text" readOnly />
    </div>,
  );

  return { ref, userEvent };
};

const isDropdownClosed = () => {
  const itemListContainer = document.querySelector('.item-list-container');
  return !!itemListContainer && itemListContainer.classList.contains('closed');
};

const getClearAllButton = () => {
  return document.querySelector('.clear-all-button') as HTMLButtonElement | null;
};

describe('ComboBox Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic rendering and initialization', () => {
    test('should render with label and closed dropdown', () => {
      renderWithProps();

      expect(screen.getByText('Test Combobox')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(isDropdownClosed()).toBeTruthy();
    });

    test('should render with required asterisk when required prop is true', () => {
      renderWithProps({ required: true });

      const requiredSpan = document.querySelector('.required-form-field');
      expect(requiredSpan).toBeInTheDocument();
      expect(requiredSpan).toHaveTextContent('*');
    });

    test('should apply custom className prop', () => {
      const customClass = 'custom-combobox-class';
      renderWithProps({ className: customClass });

      const comboboxContainer = document.querySelector(`#${comboboxId}`);
      expect(comboboxContainer).toHaveClass(customClass);
    });

    test('should initialize with selections prop', () => {
      const initialSelections: ComboOption[] = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];

      renderWithProps({ selections: initialSelections, multiSelect: true });

      expect(screen.getByText('2 things selected')).toBeInTheDocument();
    });
  });

  describe('Dropdown toggle behavior', () => {
    test('should open dropdown when clicking toggle button', async () => {
      const { userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(isDropdownClosed()).toBeFalsy();
      });
    });

    test('should close dropdown when clicking toggle button again', async () => {
      const { userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeFalsy();
      });

      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should call onClose when dropdown closes', async () => {
      const onClose = vi.fn();
      const { userEvent } = renderWithProps({ onClose });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);
      await waitFor(() => expect(isDropdownClosed()).toBeFalsy());

      await userEvent.click(toggleButton);
      await waitFor(() => expect(isDropdownClosed()).toBeTruthy());

      expect(onClose).toHaveBeenCalled();
    });

    test('should not open when combobox is disabled', async () => {
      const { userEvent } = renderWithProps({ disabled: true });

      const inputContainer = document.querySelector('.input-container');
      await userEvent.click(inputContainer!);

      const itemListContainer = document.querySelector('.item-list-container');
      expect(inputContainer).toHaveClass('disabled');
      expect(itemListContainer).not.toBeInTheDocument();
    });

    test('should show correct icon based on expanded state', async () => {
      const { userEvent } = renderWithProps();

      const getIconHref = () => {
        const icon = document.querySelector('.expand-button svg use');
        return icon?.getAttribute('xlink:href');
      };

      expect(getIconHref()).toContain('expand_more');

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getIconHref()).toContain('expand_less');
      });
    });
  });

  describe('Item selection', () => {
    test('should select item when clicked', async () => {
      const onUpdateSelection = vi.fn();
      const { userEvent } = renderWithProps({ onUpdateSelection });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const items = screen.getAllByRole('option');
      await userEvent.click(items[0]);

      await waitFor(() => {
        expect(items[0]).toHaveClass('selected');
        expect(onUpdateSelection).toHaveBeenCalled();
      });
    });

    test('should deselect item when clicking selected item', async () => {
      const { userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const firstItem = screen.getAllByRole('option')[0];
      await userEvent.click(firstItem);

      await waitFor(() => {
        expect(firstItem).toHaveClass('selected');
      });

      await userEvent.click(firstItem);

      await waitFor(() => {
        expect(firstItem).not.toHaveClass('selected');
      });
    });

    test.skip('should select item using Enter key', async () => {
      const { userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for input to be ready
      await waitFor(() => {
        const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
        expect(inputField).toBeInTheDocument();
      });

      // Navigate down to first item
      await userEvent.keyboard('{ArrowDown}');

      const items = screen.getAllByRole('option');
      await waitFor(
        () => {
          expect(items[0]).toHaveFocus();
        },
        { timeout: 2000 },
      );

      await userEvent.keyboard('{Enter}');

      await waitFor(
        () => {
          expect(items[0]).toHaveClass('selected');
        },
        { timeout: 2000 },
      );
    });

    test.skip('should select item using Space key', async () => {
      const { userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for input to be ready
      await waitFor(() => {
        const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
        expect(inputField).toBeInTheDocument();
      });

      await userEvent.keyboard('{ArrowDown}');

      const items = screen.getAllByRole('option');
      await waitFor(
        () => {
          expect(items[0]).toHaveFocus();
        },
        { timeout: 2000 },
      );

      await userEvent.keyboard(' ');

      await waitFor(
        () => {
          expect(items[0]).toHaveClass('selected');
        },
        { timeout: 2000 },
      );
    });
  });

  describe('Clear button functionality', () => {
    test('should show clear button when items are selected', async () => {
      const { userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      expect(getClearAllButton()).not.toBeInTheDocument();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const items = screen.getAllByRole('option');
      await userEvent.click(items[0]);

      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(getClearAllButton()).toBeInTheDocument();
      });
    });

    test('should clear all selections when clear button is clicked', async () => {
      const { ref, userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const items = screen.getAllByRole('option');
      await userEvent.click(items[0]);
      await userEvent.click(items[1]);

      await waitFor(() => {
        expect(ref.current?.getSelections().length).toBe(2);
      });

      await userEvent.click(toggleButton);
      await waitFor(() => expect(isDropdownClosed()).toBeTruthy());

      const clearButton = getClearAllButton();
      expect(clearButton).toBeInTheDocument();

      await userEvent.click(clearButton!);

      await waitFor(() => {
        expect(getClearAllButton()).not.toBeInTheDocument();
        expect(ref.current?.getSelections().length).toBe(0);
      });
    });

    test('should clear selections when pressing Enter on clear button', async () => {
      const { ref, userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const items = screen.getAllByRole('option');
      await userEvent.click(items[0]);
      await userEvent.click(items[1]);

      await waitFor(() => {
        expect(ref.current?.getSelections().length).toBe(2);
      });

      await userEvent.click(toggleButton);
      await waitFor(() => expect(isDropdownClosed()).toBeTruthy());

      const clearButton = getClearAllButton();
      clearButton!.focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(ref.current?.getSelections().length).toBe(0);
      });
    });
  });

  describe('Keyboard navigation', () => {
    test.skip('should navigate items with arrow keys', async () => {
      const { userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for input to be ready
      await waitFor(() => {
        const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
        expect(inputField).toBeInTheDocument();
      });

      const items = screen.getAllByRole('option');

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(items[0]).toHaveFocus(), { timeout: 2000 });

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(items[1]).toHaveFocus(), { timeout: 2000 });

      await userEvent.keyboard('{ArrowUp}');
      await waitFor(() => expect(items[0]).toHaveFocus(), { timeout: 2000 });
    });

    test.skip('should return to input field when pressing ArrowUp from first item', async () => {
      const { userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Wait for input to be ready
      await waitFor(() => {
        const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
        expect(inputField).toBeInTheDocument();
      });

      await userEvent.keyboard('{ArrowDown}');
      const items = screen.getAllByRole('option');
      await waitFor(() => expect(items[0]).toHaveFocus(), { timeout: 2000 });

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(
        () => {
          const inputField = document.querySelector(
            `#${comboboxId}-combo-box-input`,
          ) as HTMLInputElement;
          expect(inputField).toHaveFocus();
        },
        { timeout: 2000 },
      );
    });

    test('should close dropdown with Escape key', async () => {
      const { userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeFalsy();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      inputField?.focus();

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should clear input field when pressing Escape', async () => {
      const { userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'test input');

      expect(inputField!.value).toBe('test input');

      await userEvent.keyboard('{Escape}');

      expect(inputField!.value).toBe('');
    });
  });

  describe('Filtering', () => {
    test('should filter options based on input text', async () => {
      const options = [
        { label: 'my dog is red', value: 'val0' },
        { label: 'your cat is red', value: 'val1' },
        { label: 'you are blue', value: 'val2' },
        { label: 'blue is water', value: 'val3' },
        { label: 'everything blue', value: 'val4' },
      ];
      const { userEvent } = renderWithProps({ options });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'blue');

      await waitFor(() => {
        const visibleItems = screen.getAllByRole('option');
        expect(visibleItems.length).toBe(3);
        visibleItems.forEach((item) => {
          expect(item).toHaveTextContent(/blue/i);
        });
      });
    });

    test('should call onUpdateFilter when filter text changes', async () => {
      const onUpdateFilter = vi.fn();
      const { userEvent } = renderWithProps({ onUpdateFilter });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'test');

      expect(onUpdateFilter).toHaveBeenCalledWith('t');
      expect(onUpdateFilter).toHaveBeenCalledWith('te');
      expect(onUpdateFilter).toHaveBeenCalledWith('tes');
      expect(onUpdateFilter).toHaveBeenCalledWith('test');
    });

    test('should handle case-insensitive filtering', async () => {
      const options = [
        { label: 'Apple Pie', value: 'apple' },
        { label: 'banana split', value: 'banana' },
        { label: 'Cherry Tart', value: 'cherry' },
      ];
      const { userEvent } = renderWithProps({ options });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'APPLE');

      await waitFor(() => {
        const visibleItems = screen.getAllByRole('option');
        expect(visibleItems).toHaveLength(1);
        expect(visibleItems[0]).toHaveTextContent('Apple Pie');
      });
    });

    test('should clear filter when dropdown closes', async () => {
      const { userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'filter text');

      expect(inputField!.value).toBe('filter text');

      await userEvent.click(toggleButton);
      await waitFor(() => expect(isDropdownClosed()).toBeTruthy());

      await userEvent.click(toggleButton);
      await waitFor(() => expect(isDropdownClosed()).toBeFalsy());

      const inputFieldAfter = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      expect(inputFieldAfter!.value).toBe('');
    });
  });

  describe('Selection display', () => {
    test('should display selected label for single item in multi-select', async () => {
      const optionWithSelectedLabel = {
        label: 'Test Option 1',
        selectedLabel: 'Test Selection Label 1',
        value: 'testValue1',
      };
      const { ref } = renderWithProps({ options: [optionWithSelectedLabel] });

      act(() => {
        ref.current?.setSelections([optionWithSelectedLabel]);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Selection Label 1')).toBeInTheDocument();
      });
    });

    test('should display count for multiple selections', async () => {
      const options = getDefaultOptions(3);
      const { ref } = renderWithProps({ options, pluralLabel: 'things' });

      act(() => {
        ref.current?.setSelections([options[0], options[1]]);
      });

      await waitFor(() => {
        expect(screen.getByText('2 things selected')).toBeInTheDocument();
      });
    });

    test('should use selectedLabel in single-select mode when available', () => {
      const optionWithSelectedLabel = {
        label: 'Original Label',
        selectedLabel: 'Custom Selected Label',
        value: 'test-value',
      };

      renderWithProps({
        options: [optionWithSelectedLabel],
        multiSelect: false,
        selections: [optionWithSelectedLabel],
      });

      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent('Custom Selected Label');
    });

    test('should fall back to label when selectedLabel is not available', () => {
      const optionWithoutSelectedLabel = {
        label: 'Original Label',
        value: 'test-value',
      };

      renderWithProps({
        options: [optionWithoutSelectedLabel],
        multiSelect: false,
        selections: [optionWithoutSelectedLabel],
      });

      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent('Original Label');
    });
  });

  describe('Ref methods', () => {
    test('should get selections via ref', async () => {
      const options = getDefaultOptions(3);
      const { ref, userEvent } = renderWithProps({ options });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const items = screen.getAllByRole('option');
      await userEvent.click(items[0]);
      await userEvent.click(items[1]);

      await waitFor(() => {
        const selections = ref.current?.getSelections();
        expect(selections?.length).toBe(2);
        expect(selections?.[0].value).toBe('o0');
        expect(selections?.[1].value).toBe('o1');
      });
    });

    test('should set selections via ref', () => {
      const options = getDefaultOptions(3);
      const { ref } = renderWithProps({ options });

      expect(ref.current?.getSelections()).toEqual([]);

      act(() => {
        ref.current?.setSelections([options[0], options[1]]);
      });

      const selections = ref.current?.getSelections();
      expect(selections?.length).toBe(2);
    });

    test('should clear selections via ref', () => {
      const options = getDefaultOptions(3);
      const { ref } = renderWithProps({ options });

      act(() => {
        ref.current?.setSelections([options[0], options[1]]);
      });

      expect(ref.current?.getSelections()?.length).toBe(2);

      act(() => {
        ref.current?.clearSelections();
      });

      expect(ref.current?.getSelections()).toEqual([]);
    });

    test('should disable component via ref', () => {
      const { ref } = renderWithProps();

      const expandButton = document.querySelector('.expand-button') as HTMLButtonElement;
      expect(expandButton).toBeEnabled();

      act(() => {
        ref.current?.disable(true);
      });

      expect(expandButton).not.toBeEnabled();

      act(() => {
        ref.current?.disable(false);
      });

      expect(expandButton).toBeEnabled();
    });

    test('should focus input via ref', async () => {
      const { ref, userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      act(() => {
        ref.current?.focusInput();
      });

      await waitFor(() => {
        const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
        expect(inputField).toHaveFocus();
      });
    });

    test('should focus container via ref', async () => {
      const { ref } = renderWithProps();

      act(() => {
        ref.current?.focus();
      });

      await waitFor(
        () => {
          const inputContainer = document.querySelector('.input-container');
          expect(inputContainer).toHaveFocus();
        },
        { timeout: 2000 },
      );
    });
  });

  describe('ARIA attributes', () => {
    test('should have correct ARIA labels for multi-select', () => {
      const option = { label: 'theThing', value: '0' };
      renderWithProps({
        multiSelect: true,
        options: [option],
      });

      const ariaDesc = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDesc?.textContent).toContain('multi-select');
    });

    test('should have correct ARIA labels for single-select', () => {
      renderWithProps({
        multiSelect: false,
        options: getDefaultOptions(1),
      });

      const ariaDesc = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDesc?.textContent).toContain('Combo box');
      expect(ariaDesc?.textContent).not.toContain('multi-select');
    });

    test('should indicate required in ARIA description', () => {
      renderWithProps({ required: true });

      const ariaDesc = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDesc?.textContent).toContain('required');
    });

    test('should indicate disabled state in ARIA description', () => {
      renderWithProps({ disabled: true });

      const ariaDesc = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDesc?.textContent).toContain('disabled');
    });

    test('should render ariaDescription when provided', () => {
      const ariaDesc = 'Additional description for this combobox';
      renderWithProps({ ariaDescription: ariaDesc });

      const hintElement = document.querySelector(`#${comboboxId}-hint`);
      expect(hintElement).toBeInTheDocument();
      expect(hintElement).toHaveTextContent(ariaDesc);
      expect(hintElement).toHaveClass('usa-hint');
    });
  });

  describe('Error handling', () => {
    test('should render error message when errorMessage prop is provided', () => {
      const errorMessage = 'This field is required';
      renderWithProps({ errorMessage });

      const errorElement = document.querySelector(`#${comboboxId}-input__error-message`);
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(errorMessage);
      expect(errorElement).toHaveClass('usa-input__error-message');
    });

    test('should not render error message when errorMessage is empty string', () => {
      renderWithProps({ errorMessage: '' });

      const errorElement = document.querySelector(`#${comboboxId}-input__error-message`);
      expect(errorElement).not.toBeInTheDocument();
    });

    test('should apply error styling when errorMessage is provided', () => {
      const errorMessage = 'This field has an error';
      renderWithProps({ errorMessage });

      const inputContainer = document.querySelector('.input-container');
      expect(inputContainer).toHaveClass('usa-input-group--error');
    });

    test('should not apply error styling when errorMessage is empty', () => {
      renderWithProps({ errorMessage: '' });

      const inputContainer = document.querySelector('.input-container');
      expect(inputContainer).not.toHaveClass('usa-input-group--error');
    });
  });

  describe('Edge cases and special scenarios', () => {
    test('should handle empty options array gracefully', async () => {
      const { userEvent } = renderWithProps({ options: [] });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        expect(listbox.children).toHaveLength(0);
      });
    });

    test('should handle filter with no matching results', async () => {
      const options = [
        { label: 'apple', value: 'apple' },
        { label: 'banana', value: 'banana' },
      ];
      const { userEvent } = renderWithProps({ options });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'xyz');

      const listItems = document.querySelectorAll('li');
      expect(listItems).toHaveLength(0);
    });

    test('should handle divider prop on options', () => {
      const options: ComboOption[] = [
        { label: 'option 0', value: 'o0', divider: true },
        { label: 'option 1', value: 'o1', divider: false },
        { label: 'option 2', value: 'o2', divider: true },
        { label: 'option 3', value: 'o3' },
      ];

      renderWithProps({ options });

      const listItems = document.querySelectorAll('li');
      expect(listItems[0]).toHaveClass('divider');
      expect(listItems[1]).not.toHaveClass('divider');
      expect(listItems[2]).toHaveClass('divider');
      expect(listItems[3]).not.toHaveClass('divider');
    });

    test('should call onUpdateSelection upon imperative update', () => {
      const onUpdateSelection = vi.fn();
      const options = getDefaultOptions(3);
      const { ref } = renderWithProps({ options, onUpdateSelection });

      act(() => {
        ref.current?.setSelections([options[0], options[1]]);
      });

      expect(onUpdateSelection).toHaveBeenCalledTimes(1);
    });

    test('should handle rapid successive toggles gracefully', async () => {
      const { userEvent } = renderWithProps();

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);

      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);

      const itemListContainer = document.querySelector('.item-list-container');
      expect(itemListContainer).toBeInTheDocument();
    });

    test('should handle onFocus callback when input is focused', async () => {
      const onFocus = vi.fn();
      const { userEvent } = renderWithProps({ onFocus });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      inputField?.focus();

      expect(onFocus).toHaveBeenCalled();
    });
  });

  describe('Tab order (documented behavior)', () => {
    test('should be able to focus and use clear button', async () => {
      const { ref, userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      // Select items to make clear button appear
      act(() => {
        ref.current?.setSelections([getDefaultOptions(3)[0]]);
      });

      const clearButton = getClearAllButton();
      expect(clearButton).toBeInTheDocument();

      // Focus and click clear button
      clearButton!.focus();
      expect(clearButton).toHaveFocus();

      await userEvent.click(clearButton!);

      await waitFor(() => {
        expect(ref.current?.getSelections().length).toBe(0);
      });
    });

    test('should navigate with Tab key when no filter matches', async () => {
      const { ref, userEvent } = renderWithProps({ options: getDefaultOptions(3) });

      const toggleButton = screen.getByTestId(`button-${comboboxId}-expand`);
      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await userEvent.type(inputField!, 'gibberish');
      inputField!.focus();
      await userEvent.keyboard('{Tab}');

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });

      const result = ref.current?.getSelections();
      expect(result).toEqual([]);
    });
  });
});
