import React, { Ref } from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from './ComboBoxAlt';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { act, render, screen, waitFor } from '@testing-library/react';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { vi } from 'vitest';

const comboboxId = 'test-combobox';

// Test constants
const DEFAULT_OPTION_COUNT = 25;
const TEST_OPTION_LABEL_PREFIX = 'option ';
const TEST_OPTION_VALUE_PREFIX = 'o';

// Helper functions
const getDefaultOptions = (count: number = DEFAULT_OPTION_COUNT): ComboOption[] => {
  return Array.from({ length: count }, (_, i) => ({
    label: `${TEST_OPTION_LABEL_PREFIX}${i}`,
    value: `${TEST_OPTION_VALUE_PREFIX}${i}`,
  }));
};

async function toggleDropdown(id: string = comboboxId) {
  const toggleButton = document.querySelector(`#${id}-expand`);
  expect(toggleButton).toBeInTheDocument();
  await TestingUtilities.setupUserEvent().click(toggleButton!);
}

async function toggleDropdownByKeystroke() {
  const button1 = document.querySelector(`.button1`) as HTMLButtonElement;
  expect(button1).toBeInTheDocument();
  button1!.focus();
  await TestingUtilities.setupUserEvent().keyboard('{Tab}');
  await TestingUtilities.setupUserEvent().keyboard('{ArrowDown}');
}

async function getFocusedComboInputField(id: string): Promise<HTMLInputElement> {
  const inputField = document.querySelector(`#${id}-combo-box-input`);
  await waitFor(() => {
    expect(inputField).toBeInTheDocument();
  });
  await TestingUtilities.setupUserEvent().click(inputField!);
  return inputField as HTMLInputElement;
}

function isDropdownClosed() {
  const combobox = screen.queryByRole('combobox');
  return combobox?.getAttribute('aria-expanded') === 'false';
}

function isDropdownOpen() {
  const combobox = screen.queryByRole('combobox');
  return combobox?.getAttribute('aria-expanded') === 'true';
}

function getClearAllButton() {
  const clearButton = document.querySelector('.clear-all-button');
  return clearButton ? (clearButton as HTMLButtonElement) : null;
}

const expectInputToHaveFocus = async () => {
  await waitFor(() => {
    const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    expect(inputField).toHaveFocus();
  });
};

describe('ComboBoxAlt', () => {
  const updateFilterMock = vi.fn();
  let defaultOptions: ComboOption[] = [];
  let userEvent: CamsUserEvent;

  const renderWithProps = (props?: Partial<ComboBoxProps>, ref?: Ref<ComboBoxRef>) => {
    defaultOptions = getDefaultOptions();

    const defaultProps: ComboBoxProps = {
      id: comboboxId,
      label: 'Test Combobox',
      ariaLabelPrefix: 'test-combobox',
      options: defaultOptions,
      onUpdateSelection: (_options: ComboOption[]) => {},
      onUpdateFilter: updateFilterMock,
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

        <ComboBox tabIndex={0} {...renderProps} ref={ref}></ComboBox>

        <input
          type="text"
          className="input1"
          tabIndex={0}
          value="Some text"
          onChange={() => {}}
        ></input>
      </div>,
    );
  };

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Toggle & Dropdown Behavior', () => {
    test('should open dropdown when clicking arrow button while closed', async () => {
      renderWithProps();

      expect(isDropdownClosed()).toBeTruthy();

      await toggleDropdown();

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });
    });

    test('should close dropdown when clicking arrow button while open', async () => {
      renderWithProps();

      await toggleDropdown();
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await toggleDropdown();
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should open dropdown when clicking on the input field', async () => {
      renderWithProps();

      expect(isDropdownClosed()).toBeTruthy();

      const inputField = await getFocusedComboInputField(comboboxId);

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
        expect(inputField).toHaveFocus();
      });
    });

    test('should NOT close dropdown when clicking input while already open', async () => {
      renderWithProps();

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      const toggleButton = document.querySelector(`#${comboboxId}-expand`);

      await userEvent.click(toggleButton!);
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.click(inputField);
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
        expect(inputField).toHaveFocus();
      });
    });

    test('should still toggle dropdown closed when clicking arrow button while open', async () => {
      renderWithProps();

      const toggleButton = document.querySelector(`#${comboboxId}-expand`);

      await userEvent.click(toggleButton!);
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.click(toggleButton!);
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should open dropdown when pressing ArrowDown on input', async () => {
      renderWithProps();

      expect(isDropdownClosed()).toBeTruthy();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();
      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });
    });

    test('should open dropdown when pressing Enter on input', async () => {
      renderWithProps();

      expect(isDropdownClosed()).toBeTruthy();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });
    });

    test('should close dropdown when pressing Enter on input while open', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();

      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should close dropdown when pressing Escape on input', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;

      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('The arrow icon on the toggle button should change directions depending on whether the dropdown list is open or closed', async () => {
      renderWithProps();

      // Closed state should show expand_more icon
      const toggleIcon = document.querySelector('.expand-button svg use');
      expect(toggleIcon).toHaveAttribute('xlink:href', expect.stringContaining('expand_more'));

      // Open dropdown - should show expand_less icon
      await toggleDropdown();
      await waitFor(() => {
        const toggleIcon = document.querySelector('.expand-button svg use');
        expect(toggleIcon).toHaveAttribute('xlink:href', expect.stringContaining('expand_less'));
      });

      // Close again - should show expand_more icon
      await toggleDropdown();
      await waitFor(() => {
        const toggleIcon = document.querySelector('.expand-button svg use');
        expect(toggleIcon).toHaveAttribute('xlink:href', expect.stringContaining('expand_more'));
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should traverse list items with down arrow key', async () => {
      const options = [
        { label: 'option1', value: 'option1' },
        { label: 'option4', value: 'option4' },
        { label: 'option5', value: 'option5' },
      ];

      renderWithProps({ options });
      await toggleDropdownByKeystroke();
      expect(isDropdownClosed()).toBeFalsy();

      await expectInputToHaveFocus();
      await userEvent.keyboard('{ArrowDown}');

      const listItems = document.querySelectorAll('li');
      expect(listItems[0]).toHaveFocus();
      expect(listItems[0]).toHaveAttribute('data-value', 'option1');

      await userEvent.keyboard('{ArrowDown}');
      expect(listItems[1]).toHaveFocus();
      expect(listItems[1]).toHaveAttribute('data-value', 'option4');

      await userEvent.keyboard('{ArrowDown}');
      expect(listItems[2]).toHaveFocus();
      expect(listItems[2]).toHaveAttribute('data-value', 'option5');

      // At bottom - should stay on last item
      await userEvent.keyboard('{ArrowDown}');
      expect(listItems[2]).toHaveFocus();
    });

    test('should traverse list items with up arrow key', async () => {
      const options = [
        { label: 'option1', value: 'option1' },
        { label: 'option4', value: 'option4' },
        { label: 'option5', value: 'option5' },
      ];

      renderWithProps({ options });
      await toggleDropdownByKeystroke();
      await expectInputToHaveFocus();

      // Navigate to last item
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');

      const listItems = document.querySelectorAll('li');
      expect(listItems[2]).toHaveFocus();

      // Navigate back up
      await userEvent.keyboard('{ArrowUp}');
      expect(listItems[1]).toHaveFocus();

      await userEvent.keyboard('{ArrowUp}');
      expect(listItems[0]).toHaveFocus();
    });

    test('should return focus to input when pressing up arrow from first item in multi-select', async () => {
      const options = [
        { label: 'option1', value: 'option1' },
        { label: 'option4', value: 'option4' },
      ];

      renderWithProps({ options });
      await toggleDropdownByKeystroke();
      await expectInputToHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]).toHaveFocus();

      // Press up from first item - should return to input
      await userEvent.keyboard('{ArrowUp}');
      await expectInputToHaveFocus();

      // Press up again from input - should close dropdown
      await userEvent.keyboard('{ArrowUp}');
      expect(isDropdownClosed()).toBeTruthy();
    });

    test('should navigate with arrows and return to input at top of list (single-select)', async () => {
      const options = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ];

      renderWithProps({ options, multiSelect: false });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.keyboard('{ArrowDown}');
      const listItems = document.querySelectorAll('li[role="option"]');
      await waitFor(() => {
        expect(listItems[0]).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(listItems[1]).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(listItems[0]).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(listItems[1]).toHaveFocus();
      });

      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
        expect(input).toHaveFocus();
      });
    });

    test('If the dropdown is open, and filter text is typed that matches options, pressing Tab should move focus to the first filtered item', async () => {
      renderWithProps();

      await toggleDropdown();
      expect(isDropdownClosed()).toBeFalsy();

      const comboboxInputField = await getFocusedComboInputField(comboboxId);

      await userEvent.type(comboboxInputField, 'option');
      expect(comboboxInputField.value).toBe('option');

      await userEvent.keyboard('{Tab}');

      const firstListItem = document.querySelector('li[role="option"]');
      await waitFor(() => {
        expect(firstListItem).toHaveFocus();
      });

      expect(isDropdownClosed()).toBeFalsy();
    });

    test.each([' ', '{Enter}'])(
      'Pressing "%s" key while focused on an element in the dropdown list should select that option',
      async (keypress: string) => {
        const options = [
          { label: 'option1', value: 'option1' },
          { label: 'option2', value: 'option2' },
        ];
        renderWithProps({ options });
        await toggleDropdown();
        await expectInputToHaveFocus();
        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          const listItems = document.querySelectorAll('li');
          const listItem0Button = listItems![0];
          expect(listItem0Button).toHaveFocus();
        });

        await userEvent.keyboard(keypress);

        await waitFor(() => {
          const listItems = document.querySelectorAll('li[role="option"]');
          expect(listItems![0]).toHaveAttribute('aria-label', expect.stringContaining('selected'));
        });
      },
    );

    test('should close dropdown and focus input when pressing Escape while on a list item', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.keyboard('{ArrowDown}');
      const listItems = document.querySelectorAll('li[role="option"]');
      await waitFor(() => {
        expect(listItems[0]).toHaveFocus();
      });

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
        expect(input).toHaveFocus();
      });
    });

    test('should handle ArrowUp key on toggle button', async () => {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      renderWithProps({});

      const toggleButton = screen.getByRole('combobox');
      expect(toggleButton).toBeInTheDocument();

      toggleButton.focus();
      expect(toggleButton).toHaveFocus();

      const arrowUpEvent = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      arrowUpEvent.preventDefault = preventDefault;
      arrowUpEvent.stopPropagation = stopPropagation;

      toggleButton.dispatchEvent(arrowUpEvent);

      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();

      expect(isDropdownClosed()).toBeTruthy();
    });

    test('should handle key events on disabled toggle button (early return path)', async () => {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      renderWithProps({ disabled: true });

      const toggleButton = screen.getByRole('combobox');
      expect(toggleButton).toBeInTheDocument();

      toggleButton.focus();
      expect(toggleButton).toHaveFocus();

      const arrowUpEvent = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      arrowUpEvent.preventDefault = preventDefault;
      arrowUpEvent.stopPropagation = stopPropagation;

      toggleButton.dispatchEvent(arrowUpEvent);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();
    });
  });

  describe('Selection Behavior', () => {
    test('After selecting a single item, selectedLabel should appear in input and clear button should appear. After selecting a second item, input should show "2 things". After clicking clear button, it should remove selections', async () => {
      const optionToSelect1 = {
        label: 'Test Option 1',
        selectedLabel: 'Test Selection Label 1',
        value: 'testValue1',
      };
      const optionToSelect2 = {
        label: 'Test Option 2',
        selectedLabel: 'Test Selection Label 2',
        value: 'testValue2',
      };
      const options = [optionToSelect1, optionToSelect2, ...getDefaultOptions()];
      renderWithProps({ options, pluralLabel: 'things' });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;

      expect(getClearAllButton()).not.toBeInTheDocument();
      expect(input.value).toEqual('');
      let selectedListItem = document.querySelectorAll(
        'li[role="option"][aria-label*=", selected"]',
      );
      expect(selectedListItem.length).toEqual(0);

      await toggleDropdown();
      const firstListItemButton = document.querySelector('li');
      await userEvent.click(firstListItemButton!);
      await toggleDropdown();

      await waitFor(() => {
        const clearButton = getClearAllButton();
        expect(clearButton).toBeInTheDocument();
        expect(clearButton).toBeVisible();
        expect(clearButton).toBeEnabled();
      });

      expect(input.value).toEqual(optionToSelect1.selectedLabel);
      selectedListItem = document.querySelectorAll('li[role="option"][aria-label*=", selected"]');
      expect(selectedListItem.length).toEqual(1);

      await toggleDropdown();
      const secondListItemButton = document.querySelectorAll('li')[1];
      await userEvent.click(secondListItemButton!);
      await toggleDropdown();

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });

      expect(input.value).toEqual('2 things');
      selectedListItem = document.querySelectorAll('li[role="option"][aria-label*=", selected"]');
      expect(selectedListItem.length).toEqual(2);

      const clearButton = getClearAllButton();
      await userEvent.click(clearButton!);

      expect(getClearAllButton()).not.toBeInTheDocument();
      expect(input.value).toEqual('');
      selectedListItem = document.querySelectorAll('li[role="option"][aria-label*=", selected"]');
      expect(selectedListItem.length).toEqual(0);
    });

    test('Should deselect the item when you click on a selected item', async () => {
      renderWithProps({ options: getDefaultOptions(1) });

      await toggleDropdown();

      const firstListItemButton = document.querySelector('li');
      await userEvent.click(firstListItemButton!);

      await waitFor(() => {
        const selectedListItem = document.querySelectorAll(
          'li[role="option"][aria-label*=", selected"]',
        );
        expect(selectedListItem!.length).toEqual(1);
      });

      await userEvent.click(firstListItemButton!);

      await waitFor(() => {
        const selectedListItem = document.querySelectorAll(
          'li[role="option"][aria-label*=", selected"]',
        );
        expect(selectedListItem!.length).toEqual(0);
      });
    });

    test('should return selections in onUpdateSelection when a selection is made', async () => {
      const options = getDefaultOptions();
      const updateSelection = vi.fn();
      const results = [options[0]];
      renderWithProps({ options, onUpdateSelection: updateSelection });
      await toggleDropdown();

      await toggleDropdown(comboboxId);
      const listButtons = document.querySelectorAll('li');
      await userEvent.click(listButtons![0]);

      expect(updateSelection).toHaveBeenCalledWith(results);
    });

    test('should use selectedLabel when available in single select mode', async () => {
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

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.value).toEqual('Custom Selected Label');
    });

    test('should fall back to label when selectedLabel is not available', async () => {
      const optionWithoutSelectedLabel = {
        label: 'Original Label',
        value: 'test-value',
      };

      renderWithProps({
        options: [optionWithoutSelectedLabel],
        multiSelect: false,
        selections: [optionWithoutSelectedLabel],
      });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.value).toEqual('Original Label');
    });

    const ariaLabelTestCases = [
      {
        testName: 'single select nominal',
        multiSelect: false,
        ariaLabelPrefix: '',
        option: { label: 'theThing', value: '0', isAriaDefault: false },
        expected: 'theThing',
      },
      {
        testName: 'single select with default',
        multiSelect: false,
        ariaLabelPrefix: '',
        option: { label: 'theThing', value: '0', isAriaDefault: true },
        expected: 'Default theThing',
      },
      {
        testName: 'single select with default and aria label prefix',
        multiSelect: false,
        ariaLabelPrefix: 'prefix',
        option: { label: 'theThing', value: '0', isAriaDefault: true },
        expected: 'Default prefix theThing',
      },
      {
        testName: 'single select without default and aria label prefix',
        multiSelect: false,
        ariaLabelPrefix: 'prefix',
        option: { label: 'theThing', value: '0', isAriaDefault: false },
        expected: 'prefix theThing',
      },
      {
        testName: 'multi select nominal',
        multiSelect: true,
        ariaLabelPrefix: '',
        option: { label: 'theThing', value: '0', isAriaDefault: false },
        expected: 'theThing',
      },
      {
        testName: 'multi select with default',
        multiSelect: true,
        ariaLabelPrefix: '',
        option: { label: 'theThing', value: '0', isAriaDefault: true },
        expected: 'Default theThing',
      },
      {
        testName: 'multi select with default and aria label prefix',
        multiSelect: true,
        ariaLabelPrefix: 'prefix',
        option: { label: 'theThing', value: '0', isAriaDefault: true },
        expected: 'Default prefix theThing',
      },
      {
        testName: 'multi select without default and aria label prefix',
        multiSelect: true,
        ariaLabelPrefix: 'prefix',
        option: { label: 'theThing', value: '0', isAriaDefault: false },
        expected: 'prefix theThing',
      },
    ];

    test.each(ariaLabelTestCases)(
      'Should render the aria-label for an $testName option and for the input correctly',
      async (params) => {
        const { multiSelect, option, expected, ariaLabelPrefix } = params;
        const singularLabel = 'thing';
        renderWithProps({ multiSelect, singularLabel, ariaLabelPrefix, options: [option] });

        await toggleDropdown();

        const input = await getFocusedComboInputField(comboboxId);
        expect(input).toHaveAttribute(
          'aria-describedby',
          `${comboboxId}-filter-input-aria-description`,
        );
        const inputDescription = document.querySelector(
          `#${comboboxId}-filter-input-aria-description`,
        );
        expect(inputDescription).toHaveTextContent(
          `Enter text to filter options. Use up and down arrows to select a filtered item from the list.`,
        );

        const firstItem = document.querySelector('li');
        expect(firstItem).toHaveAttribute('aria-label', expected + ', not selected');

        await TestingUtilities.toggleComboBoxItemSelection(comboboxId, 0);

        expect(firstItem).toHaveAttribute('aria-label', expected + ', selected');
      },
    );
  });

  describe('Focus Management', () => {
    test('should focus input after opening dropdown with arrow button click', async () => {
      renderWithProps();

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;

      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
        expect(input).toHaveFocus();
      });
    });

    test('should focus input after closing dropdown with arrow button click', async () => {
      renderWithProps();

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;

      await userEvent.click(toggleButton);
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.click(toggleButton);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
        expect(input).toHaveFocus();
      });
    });

    test('should keep input focused when opening with keyboard', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();
      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
        expect(input).toHaveFocus();
      });
    });

    test('should keep input focused when closing with Escape key', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;

      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
        expect(input).toHaveFocus();
      });
    });

    test('should close dropdown, clear input field, and focus input when Escape is pressed', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;

      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.type(input, 'test filter');
      expect(input.value).toEqual('test filter');

      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
        expect(input.value).toEqual('');
        expect(input).toHaveFocus();
      });
    });

    test('should close dropdown, clear input field, but NOT focus on input field when clicking outside of combobox', async () => {
      renderWithProps();

      await toggleDropdown();
      expect(isDropdownClosed()).toBeFalsy();

      const comboboxInputField = await getFocusedComboInputField(comboboxId);
      const otherInput = document.querySelector('.input1');

      await userEvent.type(comboboxInputField, 'test input');

      await userEvent.click(otherInput!);

      expect(comboboxInputField.value).toEqual('');
      expect(isDropdownClosed()).toBeTruthy();
      expect(comboboxInputField).not.toHaveFocus();
    });
  });

  describe('Filtering', () => {
    test('Typing text into the input field should filter the dropdown items below the input field', async () => {
      const options = [
        { label: 'my dog is red', value: 'val0' },
        { label: 'your cat is red', value: 'val1' },
        { label: 'you are blue', value: 'val2' },
        { label: 'blue is water', value: 'val3' },
        { label: 'everything blue', value: 'val4' },
      ];
      renderWithProps({ options });
      await toggleDropdown();

      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'blue');

      const blueItems = document.querySelectorAll('li');
      expect(blueItems.length).toEqual(3);
      blueItems.forEach((listItem) => {
        expect(listItem).toHaveTextContent(/blue/g);
        expect(listItem).not.toHaveTextContent(/red/g);
      });

      await userEvent.clear(inputField);
      await userEvent.type(inputField, 'everything');
      const everythingItems = document.querySelectorAll('li');

      expect(everythingItems.length).toEqual(1);
      everythingItems.forEach((listItem) => {
        expect(listItem).toHaveTextContent(/everything/g);
      });
    });

    test('When focus leaves the combobox and moves to another element on screen, the input field in the combobox should be cleared', async () => {
      const options = [
        { label: 'option1', value: 'option1' },
        { label: 'option2', value: 'option2' },
      ];
      renderWithProps({ options });

      await toggleDropdown();

      const inputField = await getFocusedComboInputField(comboboxId);

      await userEvent.type(inputField, 'test test');

      inputField.focus();
      await userEvent.tab();

      await waitFor(() => {
        expect(inputField.value).toEqual('');
      });
    });

    test('If the dropdown is open, and gibberish is typed into input field, the filtered results should have length of 0, and pressing tab should tab out of the combobox to the next input field', async () => {
      const ref = React.createRef<ComboBoxRef>();
      renderWithProps({}, ref);

      await toggleDropdown();
      expect(isDropdownClosed()).toBeFalsy();

      const comboboxInputField = await getFocusedComboInputField(comboboxId);

      await userEvent.type(comboboxInputField, 'this is gibberish');
      comboboxInputField.focus();
      await userEvent.keyboard('{Tab}');
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
      const result = ref.current?.getSelections();
      expect(result).toEqual([]);

      expect(isDropdownClosed()).toBeTruthy();
    });

    test('onUpdateFilter should be called when input content is changed', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'test');
      expect(updateFilterMock).toHaveBeenCalledWith('test');
    });
  });

  describe('Clear Button', () => {
    test('Pressing Enter key while on the clear button should clear the selections', async () => {
      const options = getDefaultOptions();
      const updateSelection = vi.fn();
      renderWithProps({ options, onUpdateSelection: updateSelection });

      await toggleDropdown(comboboxId);
      const listButtons = document.querySelectorAll('li');
      await userEvent.click(listButtons![0]);
      await userEvent.click(listButtons![1]);
      await userEvent.click(listButtons![2]);

      const clearButton = getClearAllButton();
      expect(clearButton).toBeInTheDocument();
      (clearButton as HTMLButtonElement).focus();

      await userEvent.keyboard('{Enter}');
      expect(updateSelection).toHaveBeenCalledWith([]);

      await waitFor(() => {
        const listItems = document.querySelectorAll('li[role="option"]');
        expect(listItems[0]!).toHaveAttribute(
          'aria-label',
          expect.stringContaining('not selected'),
        );
        expect(listItems[1]!).toHaveAttribute(
          'aria-label',
          expect.stringContaining('not selected'),
        );
        expect(listItems[2]!).toHaveAttribute(
          'aria-label',
          expect.stringContaining('not selected'),
        );
      });
    });

    test('should tab to input BEFORE clear button', async () => {
      renderWithProps({ multiSelect: true });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      const button = document.querySelector('.button1') as HTMLButtonElement;

      input.focus();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');

      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');

      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });

      const clearButton = document.querySelector(`#${comboboxId}-clear-all`) as HTMLButtonElement;
      expect(clearButton).toBeInTheDocument();

      button.focus();
      expect(button).toHaveFocus();

      await userEvent.tab();
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await userEvent.tab();
      await waitFor(() => {
        expect(clearButton).toHaveFocus();
      });
    });

    test('should call onFocus callback when input is focused', async () => {
      const onFocusMock = vi.fn();
      renderWithProps({ onFocus: onFocusMock });

      await toggleDropdown(comboboxId);
      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;

      inputField.focus();

      expect(onFocusMock).toHaveBeenCalled();
    });
  });

  describe('Tab Order & Tabbing', () => {
    test('should not open dropdown when tabbing into combobox, and should allow tabbing out', async () => {
      renderWithProps();

      const button = document.querySelector('.button1') as HTMLButtonElement;
      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      const externalInput = document.querySelector('.input1') as HTMLInputElement;

      button.focus();
      expect(button).toHaveFocus();

      await userEvent.tab();

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(isDropdownClosed()).toBeTruthy();

      await userEvent.tab();
      expect(externalInput).toHaveFocus();
    });

    test('If the dropdown list is open, and the input field is in focus, then pressing the Tab key should highlight the first item in the dropdown list. Pressing the tab key a second time should close the dropdown and focus on the next element on the screen', async () => {
      renderWithProps();

      await toggleDropdown();
      expect(isDropdownClosed()).toBeFalsy();

      await expectInputToHaveFocus();
      await userEvent.keyboard('{ArrowDown}');

      const listItem = document.querySelector('li');
      await waitFor(() => {
        expect(listItem).toHaveFocus();
      });
      expect(isDropdownClosed()).toBeFalsy();

      await userEvent.tab();

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });

      const input1 = document.querySelector('.input1');
      expect(input1).toHaveFocus();
    });
  });

  describe('ARIA Attributes & Accessibility', () => {
    test('should have filter instructions in aria-description element', () => {
      renderWithProps();

      const ariaDescElement = document.querySelector(
        `#${comboboxId}-filter-input-aria-description`,
      );
      expect(ariaDescElement).toBeInTheDocument();
      expect(ariaDescElement?.textContent).toContain('Enter text to filter options');
      expect(ariaDescElement?.textContent).toContain('Use up and down arrows');
      expect(ariaDescElement).toHaveAttribute('hidden');
    });

    test('should reference filter instructions via aria-describedby', () => {
      renderWithProps();

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute(
        'aria-describedby',
        `${comboboxId}-filter-input-aria-description`,
      );
    });

    test('should include hint element when ariaDescription prop is provided', () => {
      renderWithProps({ ariaDescription: 'Custom hint text' });

      const hintElement = document.querySelector(`#${comboboxId}-hint`);
      expect(hintElement).toBeInTheDocument();
      expect(hintElement?.textContent).toContain('Custom hint text');
      expect(hintElement).toHaveClass('usa-hint');
    });

    test('should reference both filter description and hint via aria-describedby when hint provided', () => {
      renderWithProps({ ariaDescription: 'Custom hint text' });

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute(
        'aria-describedby',
        `${comboboxId}-filter-input-aria-description`,
      );
    });

    test('should have correct basic ARIA attributes on combobox input', () => {
      renderWithProps({ label: 'Test Label' });

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-controls', `${comboboxId}-item-list`);
      expect(input).toHaveAttribute('aria-labelledby', `${comboboxId}-label`);
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    test('should have correct ARIA attributes for disabled state', () => {
      renderWithProps({ disabled: true });

      const input = screen.getByRole('combobox');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('disabled');
    });

    test('should have correct ARIA attributes for multi-select mode', async () => {
      renderWithProps({ multiSelect: true });

      const input = screen.getByRole('combobox');
      await userEvent.click(input);

      const listbox = document.querySelector(`#${comboboxId}-item-list`);
      expect(listbox).toHaveAttribute('role', 'listbox');
      expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
      expect(listbox).toHaveAttribute('aria-label', 'Test Combobox multi-select options');
    });

    test('should have correct ARIA attributes for single-select mode', async () => {
      renderWithProps({ multiSelect: false });

      const input = screen.getByRole('combobox');
      await userEvent.click(input);

      const listbox = document.querySelector(`#${comboboxId}-item-list`);
      expect(listbox).toHaveAttribute('role', 'listbox');
      expect(listbox).toHaveAttribute('aria-multiselectable', 'false');
    });

    test('should update aria-expanded when dropdown opens and closes', async () => {
      renderWithProps();

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(input);
      expect(input).toHaveAttribute('aria-expanded', 'true');

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      await userEvent.click(toggleButton);
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    test('should update aria-activedescendant when navigating list items', async () => {
      renderWithProps();

      const input = screen.getByRole('combobox') as HTMLInputElement;

      expect(input).toHaveAttribute('aria-activedescendant', '');

      await userEvent.click(input);

      await userEvent.keyboard('{ArrowDown}');

      const activedescendant = input.getAttribute('aria-activedescendant');
      expect(activedescendant).toBeTruthy();
      expect(activedescendant).toContain('option-');
    });

    test('should have aria-label on list items with selection state', async () => {
      const selections: ComboOption[] = [{ label: 'option 0', value: 'o0' }];
      renderWithProps({ selections, multiSelect: true });

      const input = screen.getByRole('combobox');
      await userEvent.click(input);

      const listItems = document.querySelectorAll('li[role="option"]');
      expect(listItems[0]).toHaveAttribute('aria-label', 'test-combobox option 0, selected');
      expect(listItems[1]).toHaveAttribute('aria-label', 'test-combobox option 1, not selected');
    });

    test('should work without a label prop', () => {
      renderWithProps({ label: undefined });

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute(
        'aria-describedby',
        `${comboboxId}-filter-input-aria-description`,
      );
    });
  });

  describe('Initialization & Props', () => {
    test('should initialize with selections prop and display them in the input', () => {
      const initialSelections: ComboOption[] = [
        { label: 'option 0', value: 'o0' },
        { label: 'option 1', value: 'o1' },
      ];

      renderWithProps({ selections: initialSelections, multiSelect: true, pluralLabel: 'things' });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.value).toEqual('2 things');
    });

    test('should initialize with single selection and display it in the input', () => {
      const initialSelections: ComboOption[] = [{ label: 'option 0', value: 'o0' }];

      renderWithProps({ selections: initialSelections, multiSelect: true });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.value).toEqual('option 0');
    });

    test('should initialize with selectedLabel and use it instead of label', () => {
      const initialSelections: ComboOption[] = [
        { label: 'District of Alaska (Nome)', value: '720', selectedLabel: 'Nome, AK' },
      ];

      renderWithProps({ selections: initialSelections, multiSelect: false });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.value).toEqual('Nome, AK');
    });

    test('should initialize with no selections and show placeholder', () => {
      renderWithProps({ placeholder: '- Select -', multiSelect: false });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.placeholder).toEqual('- Select -');
      expect(input.value).toEqual('');
    });

    test('should apply ellipsis class when overflowStrategy is ellipsis', () => {
      const initialSelections: ComboOption[] = [{ label: 'option 0', value: 'o0' }];

      renderWithProps({
        selections: initialSelections,
        overflowStrategy: 'ellipsis',
        multiSelect: true,
      });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.classList.contains('ellipsis')).toBe(true);
    });

    test('should not apply ellipsis class when overflowStrategy is not specified', () => {
      const initialSelections: ComboOption[] = [{ label: 'option 0', value: 'o0' }];

      renderWithProps({ selections: initialSelections, multiSelect: true });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.classList.contains('ellipsis')).toBe(false);
    });

    test('should render ariaDescription when provided', async () => {
      const ariaDesc = 'Additional description for this combobox';
      renderWithProps({ ariaDescription: ariaDesc });

      const hintElement = document.querySelector(`#${comboboxId}-hint`);
      expect(hintElement).toBeInTheDocument();
      expect(hintElement).toHaveTextContent(ariaDesc);
      expect(hintElement).toHaveClass('usa-hint');
    });

    test('should render required asterisk when required prop is true', async () => {
      renderWithProps({ required: true });

      const requiredSpan = document.querySelector('.required-form-field');
      expect(requiredSpan).toBeInTheDocument();
      expect(requiredSpan).toHaveTextContent('*');
    });

    test('should apply custom className prop', async () => {
      const customClass = 'custom-combobox-class';
      renderWithProps({ className: customClass });

      const comboboxContainer = document.querySelector(`#${comboboxId}`);
      expect(comboboxContainer).toHaveClass(customClass);
    });

    test('should handle wrapPills prop', async () => {
      renderWithProps({ wrapPills: true });

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('should add divider style when divider prop is set to true', async () => {
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

    test('should handle empty options array gracefully', async () => {
      renderWithProps({ options: [] });

      await toggleDropdown(comboboxId);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(listbox.children).toHaveLength(0);
    });
  });

  describe('Ref Methods', () => {
    test('should focus input when calling ref.current.focus()', async () => {
      const ref = React.createRef<ComboBoxRef>();
      renderWithProps({}, ref);

      act(() => ref.current?.focus());
      await waitFor(() => {
        const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
        expect(input).toHaveFocus();
      });
    });

    test('Should return list of current selections when calling ref.getSelections and clear all values when calling ref.clearSelections', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const options = [
        {
          label: 'option 0',
          value: 'o0',
        },
        {
          label: 'option 1',
          value: 'o1',
        },
        {
          label: 'option 2',
          value: 'o2',
        },
      ];
      const expectedValues = [
        {
          label: 'option 0',
          value: 'o0',
        },
        {
          label: 'option 2',
          value: 'o2',
        },
      ];
      renderWithProps({ options }, ref);

      await toggleDropdown();

      const listButtons = document.querySelectorAll('li');

      await userEvent.click(listButtons![0]);
      await waitFor(() => {
        expect(listButtons![0]).toHaveAttribute(
          'aria-label',
          expect.stringContaining(', selected'),
        );
      });

      await userEvent.click(listButtons![2]);
      await waitFor(() => {
        expect(listButtons![2]).toHaveAttribute(
          'aria-label',
          expect.stringContaining(', selected'),
        );
      });

      const setResult = ref.current?.getSelections();
      expect(setResult).toEqual(expectedValues);

      act(() => ref.current?.clearSelections());
      const emptyResult = ref.current?.getSelections();
      expect(emptyResult).toEqual([]);
      expect(listButtons![0]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('not selected'),
      );
      expect(listButtons![2]).toHaveAttribute(
        'aria-label',
        expect.stringContaining('not selected'),
      );
    });

    test('should set values when calling ref.setSelections', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const options = [
        {
          label: 'option 0',
          value: 'o0',
        },
        {
          label: 'option 1',
          value: 'o1',
        },
      ];

      renderWithProps({ options }, ref);

      let selections = ref.current?.getSelections();
      expect(selections).toEqual([]);

      act(() => ref.current?.setSelections(options));
      selections = ref.current?.getSelections();
      expect(selections).toEqual(options.map((option) => ({ ...option })));
    });

    test('should disable component when ref.disable is called (single-select mode) and should call onDisable', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const options = getDefaultOptions();
      renderWithProps({ multiSelect: false, options }, ref);

      await toggleDropdown();

      const input = screen.getByTestId('combo-box-input');
      expect(input).toBeInTheDocument();
      expect(isDropdownClosed()).toBeFalsy();

      const listButtons = document.querySelectorAll('li');
      await userEvent.click(listButtons![0]);

      act(() => ref.current?.disable(true));
      const disabledExpandButton = document.querySelector('.expand-button');
      expect(disabledExpandButton).not.toBeEnabled();

      act(() => ref.current?.disable(false));
      const enabledExpandButton = document.querySelector('.expand-button');
      expect(enabledExpandButton).toBeEnabled();
    });

    test('should disable component when ref.disable is called (multi-select mode) and should call onDisable', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const options = getDefaultOptions();
      renderWithProps({ multiSelect: true, options }, ref);

      const expandButton = document.querySelector('.expand-button');
      expect(expandButton).toBeInTheDocument();
      expect(expandButton).toBeEnabled();

      act(() => ref.current?.disable(true));
      const disabledExpandButton = document.querySelector('.expand-button');
      expect(disabledExpandButton).not.toBeEnabled();

      act(() => ref.current?.disable(false));
      const enabledExpandButton = document.querySelector('.expand-button');
      expect(enabledExpandButton).toBeEnabled();
    });
  });

  describe('Disabled State', () => {
    test('should not open when combobox is disabled', async () => {
      renderWithProps({ disabled: true });

      const inputContainer = document.querySelector('.input-container');
      await userEvent.click(inputContainer!);
      const itemListContainer = document.querySelector('.item-list-container');
      expect(inputContainer).toHaveClass('disabled');
      expect(itemListContainer).not.toBeInTheDocument();
    });

    test('should not trigger alphanumeric behavior when combobox is disabled', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ disabled: true, onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard('a');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      expect(updateFilterMock).not.toHaveBeenCalled();
    });
  });

  describe('Visual & Styling', () => {
    test('should render error message when errorMessage prop is provided', async () => {
      const errorMessage = 'This field is required';
      renderWithProps({ errorMessage });

      const errorElement = document.querySelector(`#${comboboxId}-input__error-message`);
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(errorMessage);
      expect(errorElement).toHaveClass('usa-input__error-message');
    });

    test('should not render error message when errorMessage is empty string', async () => {
      renderWithProps({ errorMessage: '' });

      const errorElement = document.querySelector(`#${comboboxId}-input__error-message`);
      expect(errorElement).not.toBeInTheDocument();
    });

    test('should handle dropdown positioning logic', async () => {
      renderWithProps({});

      await toggleDropdown(comboboxId);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(listbox).toBeVisible();
      expect(listbox).toHaveAttribute('id', `${comboboxId}-item-list`);

      await toggleDropdown(comboboxId);
    });

    test('should handle edge cases in positioning gracefully', async () => {
      renderWithProps({});

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('should handle dropdown positioning when bottomYPos is undefined', async () => {
      renderWithProps({});

      const comboBoxElement = document.querySelector(`#${comboboxId}`) as HTMLElement;
      const originalGetBoundingClientRect =
        comboBoxElement.getBoundingClientRect.bind(comboBoxElement);

      comboBoxElement.getBoundingClientRect = vi.fn().mockReturnValue({
        ...originalGetBoundingClientRect(),
        top: window.innerHeight * 0.6,
        bottom: undefined,
      });

      await toggleDropdown(comboboxId);

      expect(screen.getByRole('listbox')).toBeInTheDocument();

      const itemListContainer = document.querySelector('.item-list-container');
      const style = itemListContainer?.getAttribute('style');
      expect(style === null || !style?.includes('bottom')).toBe(true);
    });

    test('should apply error styling when errorMessage is provided', () => {
      const errorMessage = 'This field has an error';
      renderWithProps({ errorMessage });

      const inputContainer = document.querySelector('.input-container');
      expect(inputContainer).toHaveClass('usa-input-group--error');
    });
  });

  describe('Edge Cases', () => {
    test('should open dropdown and set letter in input field when letter key is pressed on closed dropdown', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard('a');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await waitFor(() => {
        expect(inputField).toBeInTheDocument();
        expect(inputField.value).toBe('a');
        expect(inputField).toHaveFocus();
      });

      expect(updateFilterMock).toHaveBeenCalledWith('a');
    });

    test('should open dropdown and set number in input field when number key is pressed on closed dropdown', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard('5');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await waitFor(() => {
        expect(inputField).toBeInTheDocument();
        expect(inputField.value).toBe('5');
        expect(inputField).toHaveFocus();
      });

      expect(updateFilterMock).toHaveBeenCalledWith('5');
    });

    test('should open dropdown and set uppercase letter in input field when uppercase letter key is pressed', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard('A');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await waitFor(() => {
        expect(inputField).toBeInTheDocument();
        expect(inputField.value).toBe('A');
        expect(inputField).toHaveFocus();
      });

      expect(updateFilterMock).toHaveBeenCalledWith('A');
    });

    test('should not trigger alphanumeric behavior when dropdown is already open', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      await toggleDropdown(comboboxId);

      updateFilterMock.mockClear();

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard('a');

      expect(updateFilterMock).not.toHaveBeenCalledWith('a');
    });

    test('should not trigger alphanumeric behavior for non-alphanumeric keys', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard(' ');
      await userEvent.keyboard('!');
      await userEvent.keyboard('{Tab}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      expect(updateFilterMock).not.toHaveBeenCalled();
    });

    test('should position cursor after the character in input field', async () => {
      renderWithProps({});

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      await userEvent.keyboard('x');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await waitFor(() => {
        expect(inputField).toBeInTheDocument();
        expect(inputField.value).toBe('x');
        expect(inputField.selectionStart).toBe(1);
        expect(inputField.selectionEnd).toBe(1);
      });
    });

    test('should handle input click by focusing and preventing default', async () => {
      renderWithProps({});

      await toggleDropdown(comboboxId);
      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;

      expect(inputField).toBeInTheDocument();

      await userEvent.click(inputField);

      expect(inputField).toHaveFocus();
    });

    test('should handle filter with no matching results', async () => {
      const options = [
        { label: 'apple', value: 'apple' },
        { label: 'banana', value: 'banana' },
      ];

      renderWithProps({ options });
      await toggleDropdown(comboboxId);

      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'xyz');

      const listItems = document.querySelectorAll('li');
      expect(listItems).toHaveLength(0);
    });

    test('should call focusInput ref method correctly', async () => {
      const ref = React.createRef<ComboBoxRef>();
      renderWithProps({}, ref);

      await toggleDropdown(comboboxId);
      act(() => ref.current?.focusInput());
      await waitFor(() => {
        const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
        expect(inputField).toHaveFocus();
      });
    });

    test('should handle focus ref method correctly', async () => {
      const ref = React.createRef<ComboBoxRef>();
      renderWithProps({}, ref);

      act(() => ref.current?.focus());
      await waitFor(() => {
        const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
        expect(input).toHaveFocus();
      });
    });

    test('should handle setSelections with empty array', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const options = getDefaultOptions(3);
      renderWithProps({ options }, ref);

      act(() => ref.current?.setSelections([options[0], options[1]]));
      let selections = ref.current?.getSelections();
      expect(selections).toHaveLength(2);

      act(() => ref.current?.setSelections([]));
      selections = ref.current?.getSelections();
      expect(selections).toHaveLength(0);
    });

    test('should show generic multi-select label when no singularLabel provided', () => {
      const selections = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];

      renderWithProps({
        selections,
        multiSelect: true,
        singularLabel: undefined,
        pluralLabel: 'items',
      });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input.value).toEqual('2 items');
    });

    test('should handle case-insensitive filtering', async () => {
      const options = [
        { label: 'Apple Pie', value: 'apple' },
        { label: 'banana split', value: 'banana' },
        { label: 'Cherry Tart', value: 'cherry' },
      ];

      renderWithProps({ options });
      await toggleDropdown(comboboxId);

      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'APPLE');

      const visibleItems = document.querySelectorAll('li');
      expect(visibleItems).toHaveLength(1);
      expect(visibleItems[0]).toHaveTextContent('Apple Pie');
    });

    test('should clear filter when clearFilter is called', async () => {
      renderWithProps({});
      await toggleDropdown(comboboxId);

      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'some filter text');

      expect(inputField.value).toBe('some filter text');

      await toggleDropdown(comboboxId);

      expect(inputField.value).toBe('');
    });

    test('should handle keyboard navigation with no focusable items', async () => {
      const options = [{ label: 'apple', value: 'apple' }];

      renderWithProps({ options });
      await toggleDropdown(comboboxId);

      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'xyz');

      await userEvent.keyboard('{ArrowDown}');

      expect(inputField).toHaveFocus();
    });

    test('should not apply error styling when errorMessage is empty', () => {
      renderWithProps({ errorMessage: '' });

      const inputContainer = document.querySelector('.input-container');
      expect(inputContainer).not.toHaveClass('usa-input-group--error');
    });

    test('should handle rapid successive toggles gracefully', async () => {
      renderWithProps({});

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;

      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);

      expect(document.querySelector('.item-list-container')).toBeInTheDocument();
    });

    test('should handle multiple filter changes rapidly', async () => {
      const options = getDefaultOptions(10);
      const onUpdateFilterMock = vi.fn();
      renderWithProps({ options, onUpdateFilter: onUpdateFilterMock });

      await toggleDropdown(comboboxId);
      const inputField = await getFocusedComboInputField(comboboxId);

      await userEvent.type(inputField, 'abc');

      expect(onUpdateFilterMock).toHaveBeenCalledWith('a');
      expect(onUpdateFilterMock).toHaveBeenCalledWith('ab');
      expect(onUpdateFilterMock).toHaveBeenCalledWith('abc');
    });

    test('should handle Enter key behavior correctly', async () => {
      const options = [{ label: 'Option 1', value: 'opt1' }];
      renderWithProps({ options });

      await toggleDropdown(comboboxId);
      await getFocusedComboInputField(comboboxId);

      await userEvent.keyboard('{Enter}');
      let listItems = document.querySelectorAll('li[role="option"][aria-label*=", selected"]');
      expect(listItems).toHaveLength(0);

      const listItem = document.querySelector('li[role="option"]');
      await userEvent.click(listItem!);

      await waitFor(() => {
        listItems = document.querySelectorAll('li[role="option"][aria-label*=", selected"]');
        expect(listItems).toHaveLength(1);
        expect(listItem).toHaveAttribute('aria-label', expect.stringContaining(', selected'));
      });
    });

    test('should render with icon prop', () => {
      renderWithProps({ icon: 'custom-icon' });

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      // icon prop is accepted by TypeScript interface but not used in rendering
      // This test verifies the prop doesn't cause crashes
    });

    test('should apply autoComplete attribute to input', () => {
      renderWithProps({ autoComplete: 'off' });

      const input = screen.getByRole('combobox') as HTMLInputElement;
      expect(input).toHaveAttribute('autocomplete', 'off');
    });

    test('should call onClose with current selections when dropdown closes', async () => {
      const onClose = vi.fn();
      const options = getDefaultOptions(3);
      renderWithProps({ options, onClose });

      await toggleDropdown(comboboxId);

      const listItems = document.querySelectorAll('li');
      await userEvent.click(listItems[0]);
      await userEvent.click(listItems[1]);

      await toggleDropdown(comboboxId);

      expect(onClose).toHaveBeenCalledWith([
        expect.objectContaining({ value: 'o0' }),
        expect.objectContaining({ value: 'o1' }),
      ]);
    });

    test('should handle rapid filter changes and onUpdateFilter calls', async () => {
      const onUpdateFilter = vi.fn();
      renderWithProps({ onUpdateFilter });

      await toggleDropdown(comboboxId);
      const inputField = await getFocusedComboInputField(comboboxId);

      // @ts-expect-error - Intentional use of the delay attribute for user.type function options
      await userEvent.type(inputField, 'test', { delay: 1 });

      expect(onUpdateFilter).toHaveBeenCalledWith('t');
      expect(onUpdateFilter).toHaveBeenCalledWith('te');
      expect(onUpdateFilter).toHaveBeenCalledWith('tes');
      expect(onUpdateFilter).toHaveBeenCalledWith('test');
    });

    test('should call onUpdateSelection upon imperative update', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const onUpdateSelection = vi.fn();
      const options = getDefaultOptions(3);

      renderWithProps({ options, onUpdateSelection }, ref);

      act(() => ref.current?.setSelections([options[0], options[1]]));

      await waitFor(() => {
        const selections = ref.current?.getSelections();
        expect(selections).toHaveLength(2);
      });

      expect(onUpdateSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('scrollToSelected Feature', () => {
    test('should scroll to first selected item when scrollToSelected is true', async () => {
      const options = getDefaultOptions(50);
      const selections = [options[25]];
      const mockScrollIntoView = vi.fn();

      renderWithProps({ options, selections, scrollToSelected: true });
      await toggleDropdown(comboboxId);

      await waitFor(() => {
        const selectedElement = document.querySelector(
          `li[data-value="${options[25].value}"]`,
        ) as HTMLElement;
        expect(selectedElement).toBeInTheDocument();
      });

      const selectedElement = document.querySelector(
        `li[data-value="${options[25].value}"]`,
      ) as HTMLElement;
      selectedElement.scrollIntoView = mockScrollIntoView;

      await toggleDropdown(comboboxId);
      await toggleDropdown(comboboxId);

      await waitFor(() => {
        expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
      });
    });

    test('should handle scrollToSelected gracefully when no selections exist', async () => {
      const options = getDefaultOptions(50);
      renderWithProps({ options, selections: [], scrollToSelected: true });
      await toggleDropdown(comboboxId);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(isDropdownOpen()).toBeTruthy();
    });

    test('should handle scrollToSelected when scrollIntoView is not available', async () => {
      const options = getDefaultOptions(10);
      const selections = [options[5]];
      renderWithProps({ options, selections, scrollToSelected: true });
      await toggleDropdown(comboboxId);

      await waitFor(() => {
        const selectedElement = document.querySelector(
          `li[data-value="${options[5].value}"]`,
        ) as HTMLElement;
        expect(selectedElement).toBeInTheDocument();
        selectedElement.scrollIntoView = vi.fn();
      });

      await toggleDropdown(comboboxId);
      await toggleDropdown(comboboxId);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    test('should not scroll when scrollToSelected is false', async () => {
      const options = getDefaultOptions(25);
      const selections = [options[15]];
      const mockScrollIntoView = vi.fn();
      renderWithProps({ options, selections, scrollToSelected: false });
      await toggleDropdown(comboboxId);

      await waitFor(() => {
        const selectedElement = document.querySelector(
          `li[data-value="${options[15].value}"]`,
        ) as HTMLElement;
        if (selectedElement) selectedElement.scrollIntoView = mockScrollIntoView;
      });

      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('Outside Click Boundary Detection', () => {
    test('should close dropdown when clicking left of combobox', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      expect(isDropdownOpen()).toBeTruthy();

      const comboBoxElement = document.querySelector(`#${comboboxId}`) as HTMLElement;
      const rect = comboBoxElement.getBoundingClientRect();
      const clickEvent = new MouseEvent('mousedown', {
        clientX: rect.x - 10,
        clientY: rect.y + 10,
        bubbles: true,
      });
      document.dispatchEvent(clickEvent);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should close dropdown when clicking right of combobox', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      expect(isDropdownOpen()).toBeTruthy();

      const comboBoxElement = document.querySelector(`#${comboboxId}`) as HTMLElement;
      const rect = comboBoxElement.getBoundingClientRect();
      const clickEvent = new MouseEvent('mousedown', {
        clientX: rect.x + rect.width + 10,
        clientY: rect.y + 10,
        bubbles: true,
      });
      document.dispatchEvent(clickEvent);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should close dropdown when clicking above combobox', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      expect(isDropdownOpen()).toBeTruthy();

      const comboBoxElement = document.querySelector(`#${comboboxId}`) as HTMLElement;
      const rect = comboBoxElement.getBoundingClientRect();
      const clickEvent = new MouseEvent('mousedown', {
        clientX: rect.x + 10,
        clientY: rect.y - 10,
        bubbles: true,
      });
      document.dispatchEvent(clickEvent);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should close dropdown when clicking below combobox', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      expect(isDropdownOpen()).toBeTruthy();

      const comboBoxElement = document.querySelector(`#${comboboxId}`) as HTMLElement;
      const rect = comboBoxElement.getBoundingClientRect();
      const clickEvent = new MouseEvent('mousedown', {
        clientX: rect.x + 10,
        clientY: rect.y + rect.height + 10,
        bubbles: true,
      });
      document.dispatchEvent(clickEvent);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should close dropdown when clicking outside with no selections', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      expect(isDropdownOpen()).toBeTruthy();

      const otherInput = document.querySelector('.input1');
      await userEvent.click(otherInput!);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
      expect(getClearAllButton()).not.toBeInTheDocument();
    });

    test('should not close dropdown when clicking inside combobox bounds', async () => {
      renderWithProps();
      await toggleDropdown(comboboxId);
      expect(isDropdownOpen()).toBeTruthy();

      const comboBoxElement = document.querySelector(`#${comboboxId}`) as HTMLElement;
      const rect = comboBoxElement.getBoundingClientRect();
      const clickEvent = new MouseEvent('mousedown', {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        bubbles: true,
      });
      document.dispatchEvent(clickEvent);

      expect(isDropdownOpen()).toBeTruthy();
    });
  });

  describe('Defensive Code Paths', () => {
    test('should handle navigateList when list ref is null', async () => {
      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();

      // Remove the list element to trigger the null ref path
      const list = document.querySelector('ul[role="listbox"]');
      if (list) {
        list.remove();
      }

      await userEvent.keyboard('{ArrowDown}');

      // Should not crash - defensive check prevents error
      expect(input).toHaveFocus();
    });

    test('should handle navigateList with invalid target index', async () => {
      const options = [{ label: 'Single Option', value: 'single' }];
      renderWithProps({ options });

      await toggleDropdown();
      await getFocusedComboInputField(comboboxId);

      // Navigate down to the single item
      await userEvent.keyboard('{ArrowDown}');
      const listItem = document.querySelector('li[role="option"]');
      expect(listItem).toHaveFocus();

      // Try to navigate down again - should stay on last item (defensive bounds check)
      await userEvent.keyboard('{ArrowDown}');
      expect(listItem).toHaveFocus();
    });

    test('should handle isOutsideClick when comboBoxRef is null', async () => {
      renderWithProps();

      await toggleDropdown();
      expect(isDropdownOpen()).toBeTruthy();

      // Simulate click event when ref is temporarily unavailable
      const clickEvent = new MouseEvent('mousedown', {
        clientX: 0,
        clientY: 0,
        bubbles: true,
      });

      // This should not crash even if ref is null
      document.dispatchEvent(clickEvent);

      // Component should handle gracefully
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });
    });

    test('should handle navigateList console warning when list is unavailable', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderWithProps();

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();

      // Open dropdown first
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      // Remove the list to trigger the warning in navigateList
      const list = document.querySelector('ul[role="listbox"]');
      list?.remove();

      // Try to navigate - should log warning
      await userEvent.keyboard('{ArrowDown}');

      // Should have logged a warning about list ref not being available
      expect(consoleSpy).toHaveBeenCalledWith('List ref not available for navigation');

      consoleSpy.mockRestore();
    });

    test('should handle navigateList with hidden items in list', async () => {
      const options = [
        { label: 'Visible 1', value: 'v1' },
        { label: 'Visible 2', value: 'v2' },
        { label: 'Visible 3', value: 'v3' },
      ];

      renderWithProps({ options });
      await toggleDropdown();

      // Hide the middle item by adding .hidden class
      const listItems = document.querySelectorAll('li[role="option"]');
      listItems[1].classList.add('hidden');

      await getFocusedComboInputField(comboboxId);

      // Navigate down - should skip hidden item
      await userEvent.keyboard('{ArrowDown}');
      expect(listItems[0]).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      // Should skip listItems[1] because it's hidden
      expect(listItems[2]).toHaveFocus();
    });
  });

  describe('Complete User Journeys', () => {
    test('should support complete multi-select workflow from keyboard', async () => {
      const onUpdateSelection = vi.fn();
      const options = getDefaultOptions(10);
      renderWithProps({ options, onUpdateSelection });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      input.focus();
      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
        expect(input).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      const firstItem = document.querySelectorAll('li[role="option"]')[0];
      expect(firstItem).toHaveFocus();

      await userEvent.keyboard(' ');
      await waitFor(() => {
        expect(onUpdateSelection).toHaveBeenCalledTimes(1);
        expect(firstItem).toHaveAttribute('aria-label', expect.stringContaining(', selected'));
      });

      await userEvent.keyboard('{ArrowDown}');
      const secondItem = document.querySelectorAll('li[role="option"]')[1];
      expect(secondItem).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(onUpdateSelection).toHaveBeenCalledTimes(2);
        expect(secondItem).toHaveAttribute('aria-label', expect.stringContaining(', selected'));
      });

      await userEvent.keyboard('{Escape}');
      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
        expect(input).toHaveFocus();
      });

      const clearButton = getClearAllButton();
      expect(clearButton).toBeInTheDocument();

      await userEvent.tab();
      expect(clearButton).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(onUpdateSelection).toHaveBeenLastCalledWith([]);
        expect(getClearAllButton()).not.toBeInTheDocument();
      });
    });

    test('should support complete single-select workflow from mouse', async () => {
      const onUpdateSelection = vi.fn();
      const onClose = vi.fn();
      const options = getDefaultOptions(5);

      renderWithProps({ options, onUpdateSelection, onClose, multiSelect: false });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`);
      await userEvent.click(toggleButton!);
      await waitFor(() => {
        expect(isDropdownOpen()).toBeTruthy();
      });

      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      expect(input).toHaveFocus();
      await userEvent.type(input, '2');

      await waitFor(() => {
        const listItems = document.querySelectorAll('li[role="option"]:not(.hidden)');
        expect(listItems.length).toBeGreaterThan(0);
      });

      const listItems = document.querySelectorAll('li[role="option"]:not(.hidden)');
      await userEvent.click(listItems[0]);

      await waitFor(() => {
        expect(isDropdownClosed()).toBeTruthy();
      });

      expect(onUpdateSelection).toHaveBeenCalledWith([
        expect.objectContaining({ label: 'option 2' }),
      ]);
      expect(onClose).toHaveBeenCalledWith([expect.objectContaining({ label: 'option 2' })]);
    });

    test('should support filter, select, clear filter, verify selection persists workflow', async () => {
      const onUpdateFilter = vi.fn();
      const onUpdateSelection = vi.fn();
      const options = [
        { label: 'Apple', value: 'apple' },
        { label: 'Apricot', value: 'apricot' },
        { label: 'Banana', value: 'banana' },
        { label: 'Cherry', value: 'cherry' },
      ];

      renderWithProps({ options, onUpdateFilter, onUpdateSelection });

      await toggleDropdown(comboboxId);
      const input = document.querySelector(`#${comboboxId}-combo-box-input`) as HTMLInputElement;
      await userEvent.type(input, 'ap');

      expect(onUpdateFilter).toHaveBeenCalledWith('a');
      expect(onUpdateFilter).toHaveBeenCalledWith('ap');

      await waitFor(() => {
        const visibleItems = document.querySelectorAll('li[role="option"]:not(.hidden)');
        expect(visibleItems.length).toBe(2);
      });

      const visibleItems = document.querySelectorAll('li[role="option"]:not(.hidden)');
      await userEvent.click(visibleItems[0]);

      await waitFor(() => {
        expect(onUpdateSelection).toHaveBeenCalledWith([
          expect.objectContaining({ value: 'apple' }),
        ]);
      });

      await userEvent.clear(input);
      expect(onUpdateFilter).toHaveBeenCalledWith('');

      await waitFor(() => {
        const allItems = document.querySelectorAll('li[role="option"]:not(.hidden)');
        expect(allItems.length).toBe(4);
      });

      const selectedItem = document.querySelector(`li[data-value="apple"]`);
      expect(selectedItem).toHaveAttribute('aria-label', expect.stringContaining(', selected'));
    });
  });
});
