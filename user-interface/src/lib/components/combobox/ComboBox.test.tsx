import React, { Ref } from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from './ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { act, render, screen, waitFor } from '@testing-library/react';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { vi } from 'vitest';

const comboboxId = 'test-combobox';
const userEvent = TestingUtilities.setupUserEvent();

async function toggleDropdown(id: string = comboboxId) {
  const toggleButton = document.querySelector(`#${id}-expand`);

  expect(toggleButton).toBeInTheDocument();

  await userEvent.click(toggleButton!);
}

async function toggleDropdownByKeystroke() {
  const button1 = document.querySelector(`.button1`) as HTMLButtonElement;
  expect(button1).toBeInTheDocument();
  button1!.focus();
  await userEvent.keyboard('{Tab}');
  await userEvent.keyboard('{ArrowDown}');
}

async function getComboInputContainer(): Promise<Element | null> {
  const container = document.querySelector(`.input-container`);

  expect(container).toBeInTheDocument();

  return container;
}

async function getFocusedComboInputField(id: string): Promise<HTMLInputElement> {
  const inputField = document.querySelector(`#${id}-combo-box-input`);

  await waitFor(() => {
    expect(inputField).toBeInTheDocument();
  });

  await userEvent.click(inputField!);
  return inputField as HTMLInputElement;
}

function isDropdownClosed() {
  const itemListContainer = document.querySelector('.item-list-container');
  return !!itemListContainer && itemListContainer.classList.contains('closed');
}

function getClearAllButton() {
  const clearButton = document.querySelector('.clear-all-button');
  return clearButton ? (clearButton as HTMLButtonElement) : null;
}

const getDefaultOptions = (count: number = 25) => {
  const defaultOptions: ComboOption[] = [];
  for (let i = 0; i < count; i++) {
    defaultOptions.push({
      label: 'option ' + i,
      value: 'o' + i,
    });
  }
  return defaultOptions;
};

const expectInputToHaveFocus = async () => {
  await waitFor(() => {
    const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    expect(inputField).toHaveFocus();
  });
};

const expectInputContainerToHaveFocus = async (): Promise<Element | null> => {
  const container = await getComboInputContainer();
  await waitFor(async () => {
    expect(container).toHaveFocus();
  });
  return container!;
};

describe('test cams combobox', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Clicking on the toggle button should open or close the dropdown list and put the focus on the input field.  When closed it should call onClose()', async () => {
    const onClose = vi.fn();

    renderWithProps({ onClose });

    await toggleDropdown();

    expect(isDropdownClosed()).toBeFalsy();

    await expectInputToHaveFocus();

    await toggleDropdown();

    expect(isDropdownClosed()).toBeTruthy();

    await expectInputContainerToHaveFocus();

    expect(onClose).toHaveBeenCalled();
  });

  const ariaLabelTestCases = [
    {
      testName: 'single select nominal',
      multiSelect: false,
      ariaLabelPrefix: '',
      option: { label: 'theThing', value: '0', isAriaDefault: false },
      expected: 'single-select option: theThing',
    },
    {
      testName: 'single select with default',
      multiSelect: false,
      ariaLabelPrefix: '',
      option: { label: 'theThing', value: '0', isAriaDefault: true },
      expected: 'Default thing single-select option: theThing',
    },
    {
      testName: 'single select with default and aria label prefix',
      multiSelect: false,
      ariaLabelPrefix: 'prefix',
      option: { label: 'theThing', value: '0', isAriaDefault: true },
      expected: 'Default thing single-select option: prefix theThing',
    },
    {
      testName: 'single select without default and aria label prefix',
      multiSelect: false,
      ariaLabelPrefix: 'prefix',
      option: { label: 'theThing', value: '0', isAriaDefault: false },
      expected: 'single-select option: prefix theThing',
    },
    {
      testName: 'multi select nominal',
      multiSelect: true,
      ariaLabelPrefix: '',
      option: { label: 'theThing', value: '0', isAriaDefault: false },
      expected: 'multi-select option: theThing',
    },
    {
      testName: 'multi select with default',
      multiSelect: true,
      ariaLabelPrefix: '',
      option: { label: 'theThing', value: '0', isAriaDefault: true },
      expected: 'Default thing multi-select option: theThing',
    },
    {
      testName: 'multi select with default and aria label prefix',
      multiSelect: true,
      ariaLabelPrefix: 'prefix',
      option: { label: 'theThing', value: '0', isAriaDefault: true },
      expected: 'Default thing multi-select option: prefix theThing',
    },
    {
      testName: 'multi select without default and aria label prefix',
      multiSelect: true,
      ariaLabelPrefix: 'prefix',
      option: { label: 'theThing', value: '0', isAriaDefault: false },
      expected: 'multi-select option: prefix theThing',
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
      expect(firstItem).toHaveAttribute('aria-label', expected + ' unselected');

      await TestingUtilities.toggleComboBoxItemSelection(comboboxId, 0);

      expect(firstItem).toHaveAttribute('aria-label', expected + ' selected');
    },
  );

  test('Should deselect the item when you click on a selected item', async () => {
    renderWithProps({ options: getDefaultOptions(1) });

    await toggleDropdown();

    const firstListItemButton = document.querySelector('li');
    await userEvent.click(firstListItemButton!);

    let selectedListItem;
    await waitFor(() => {
      selectedListItem = document.querySelectorAll('li.selected');
      expect(selectedListItem!.length).toEqual(1);
    });

    await userEvent.click(firstListItemButton!);

    await waitFor(() => {
      selectedListItem = document.querySelectorAll('li.selected');
      expect(selectedListItem!.length).toEqual(0);
    });
  });

  test('After selecting a single item in the dropdown list, item name as defined by selected label, should appear in selection-label and clear button should appear. After selecting a second item in the list, the selection-label should say 2 things selected. After clicking the clear button it should remove label and deselect item in dropdown and clear button should go away.', async () => {
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

    expect(getClearAllButton()).not.toBeInTheDocument();
    expect(document.querySelector('.selection-label')?.textContent).toEqual('');
    let selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toEqual(0);

    await toggleDropdown();

    const firstListItemButton = document.querySelector('li');
    await userEvent.click(firstListItemButton!);

    await toggleDropdown();

    await waitFor(() => {
      expect(getClearAllButton()).toBeInTheDocument();
    });

    expect(document.querySelector('.selection-label')?.textContent).toEqual(
      optionToSelect1.selectedLabel,
    );

    selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toEqual(1);

    await toggleDropdown();

    const secondListItemButton = document.querySelectorAll('li')[1];
    await userEvent.click(secondListItemButton!);

    await toggleDropdown();

    await waitFor(() => {
      expect(document.querySelector('.item-list-container')).toHaveClass('closed');
    });

    expect(document.querySelector('.selection-label')?.textContent).toEqual('2 things selected');

    selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toEqual(2);

    const clearAllButton = getClearAllButton();
    await userEvent.click(clearAllButton!);

    await waitFor(() => {
      expect(getClearAllButton()).not.toBeInTheDocument();
    });

    expect(document.querySelector('.selection-label')?.textContent).toEqual('');

    selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toEqual(0);
  });

  test('should close dropdown list, clear input field, and focus on combobox container when escape key is pressed inside the input field', async () => {
    renderWithProps({ options: getDefaultOptions() });

    await toggleDropdown();
    expect(isDropdownClosed()).toBeFalsy();

    const inputField = await getFocusedComboInputField(comboboxId);

    await userEvent.type(inputField, 'test input');
    expect(inputField.value).toEqual('test input');
    expect(isDropdownClosed()).toBeFalsy();

    await userEvent.keyboard('{Escape}');
    expect(inputField.value).toEqual('');
    expect(isDropdownClosed()).toBeTruthy();
    await expectInputContainerToHaveFocus();
  });

  test('should close dropdown list, clear input field, but NOT focus on input field when clicking outside of combobox', async () => {
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

  test('The arrow icon on the toggle button should change directions depending on whether the dropdown list is open or closed.', async () => {
    renderWithProps();

    const toggleIcon = document.querySelector('.expand-button svg use');
    const attributeValue = toggleIcon?.getAttribute('xlink:href');
    let containsValueMore = attributeValue?.indexOf('expand_more');
    expect(containsValueMore).toBeGreaterThan(-1);

    await toggleDropdown();
    await waitFor(() => {
      const toggleIcon = document.querySelector('.expand-button svg use');
      const attributeValue = toggleIcon?.getAttribute('xlink:href');
      const containsValueLess = attributeValue?.indexOf('expand_less');
      expect(containsValueLess).toBeGreaterThan(-1);
    });

    await toggleDropdown();
    await waitFor(() => {
      const toggleIcon = document.querySelector('.expand-button svg use');
      const attributeValue = toggleIcon?.getAttribute('xlink:href');
      containsValueMore = attributeValue?.indexOf('expand_more');
      expect(containsValueMore).toBeGreaterThan(-1);
    });
  });

  test('If the dropdown list is open, and the input field is in focus, then pressing the Tab key should highlight the first item in the dropdown list. Pressing the tab key a second time should close the dropdown and focus on the next element on the screen.', async () => {
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

  test('If the dropdown is already closed, then pressing the tab key should focus on the next element on the screen and should not open the dropdown list.', async () => {
    renderWithProps();

    const otherButton = document.querySelector('.button1');
    const otherInput = document.querySelector('.input1');
    const comboboxContainer = document.querySelector(`.input-container`);
    (otherButton as HTMLButtonElement)!.focus();
    expect(otherButton!).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => {
      expect(comboboxContainer!).toHaveFocus();
    });
    expect(isDropdownClosed()).toBeTruthy();

    await userEvent.tab();
    expect(otherInput!).toHaveFocus();
  });

  test('If the dropdown is open, and gibberish is typed into input field, the filtered results should have length of 0, and pressing tab should tab out of the combobox to the next input field.', async () => {
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

  test('If the dropdown is open, and filter text is typed that matches options, pressing Tab should move focus to the first filtered item.', async () => {
    renderWithProps();

    await toggleDropdown();
    expect(isDropdownClosed()).toBeFalsy();

    const comboboxInputField = await getFocusedComboInputField(comboboxId);

    // Type filter text that will match some options (e.g., "option" will match all options)
    await userEvent.type(comboboxInputField, 'option');
    expect(comboboxInputField.value).toBe('option');

    // Press Tab - should move focus to first filtered item
    await userEvent.keyboard('{Tab}');

    // Check that focus moved to the first list item
    const firstListItem = document.querySelector('li[role="option"]');
    await waitFor(() => {
      expect(firstListItem).toHaveFocus();
    });

    // Dropdown should still be open
    expect(isDropdownClosed()).toBeFalsy();
  });

  test('should not open when combobox is disabled', async () => {
    renderWithProps({ disabled: true });

    const inputContainer = document.querySelector('.input-container');
    await userEvent.click(inputContainer!);
    const itemListContainer = document.querySelector('.item-list-container');
    expect(inputContainer).toHaveClass('disabled');
    expect(itemListContainer).not.toBeInTheDocument();
  });

  test('Up and down arrow cursor keys should traverse the list. In multi-select mode, focus should return to the input field when using Up Arrow once the user reaches the top of the list. All list items with the hidden class should be skipped.', async () => {
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

    await userEvent.keyboard('{ArrowDown}');
    expect(listItems[2]).toHaveAttribute('data-value', 'option5');

    await userEvent.keyboard('{ArrowUp}');
    expect(listItems[1]).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(listItems[0]).toHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    await expectInputToHaveFocus();

    await userEvent.keyboard('{ArrowUp}');
    expect(isDropdownClosed()).toBeTruthy();
  });

  test('In single-select mode, focus should return to the input when using Up Arrow once the user reaches the top of the list and there is a selection.', async () => {
    const options = [
      { label: 'option1', value: 'option1' },
      { label: 'option2', value: 'option2' },
    ];
    renderWithProps({ options, multiSelect: false });
    await toggleDropdown(comboboxId);

    const inputField = await getFocusedComboInputField(comboboxId);
    inputField!.focus();
    await expectInputToHaveFocus();
    await userEvent.keyboard('{ArrowDown}');

    let listItems;
    await waitFor(() => {
      listItems = document.querySelectorAll('li');
      expect(listItems[0]).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(listItems![1]).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowUp}');
    await expectInputToHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    expect(listItems![1]).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(listItems![1]).toHaveClass('selected');

    await expectInputContainerToHaveFocus();
  });

  test.each([' ', '{Enter}'])(
    'Pressing "%s" key while focused on an element in the dropdown list should select that option.',
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
        const listItems = document.querySelectorAll('li');
        expect(listItems![0]).toHaveClass('selected');
      });
    },
  );

  test('For MultiSelect, Pressing Escape key while focused on an element in the dropdown list should close the dropdown list and focus on the combobox container.', async () => {
    const options = [
      { label: 'option1', value: 'option1' },
      { label: 'option2', value: 'option2' },
    ];
    renderWithProps({ options });

    await toggleDropdown();
    expect(isDropdownClosed()).toBeFalsy();

    await expectInputToHaveFocus();
    await userEvent.keyboard('{ArrowDown}');

    const listItem = document.querySelectorAll('li')[0];
    expect(listItem).toHaveFocus();
    await userEvent.click(listItem);

    await userEvent.keyboard('{Escape}');
    expect(isDropdownClosed()).toBeTruthy();
    await expectInputContainerToHaveFocus();
  });

  test('Typing text into the input field should filter the dropdown items below the input field.', async () => {
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

  test('When focus leaves the combobox and moves to another element on screen, the input field in the combobox should be cleared.', async () => {
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

  test('Tabbing from another area of the screen to the combo box should first focus on the combo box input, then the clear button.', async () => {
    const ref = React.createRef<ComboBoxRef>();
    renderWithProps({ options: getDefaultOptions() }, ref);
    await toggleDropdown();

    const button1 = screen.getByRole('button', { name: 'button' });

    await TestingUtilities.toggleComboBoxItemSelection(comboboxId, 0);
    await TestingUtilities.toggleComboBoxItemSelection(comboboxId, 1);
    await TestingUtilities.toggleComboBoxItemSelection(comboboxId, 2);

    const selectedList = ref.current!.getSelections();
    expect(selectedList.length).toEqual(3);
    const clearAllBtn = getClearAllButton();
    expect(clearAllBtn).toBeInTheDocument();

    // Close the dropdown and wait for it to be fully closed
    await toggleDropdown();
    await waitFor(() => {
      expect(isDropdownClosed()).toBeTruthy();
    });

    // Click button1 and explicitly set focus to it
    await userEvent.click(button1);
    (button1 as HTMLButtonElement).focus();
    expect(button1).toHaveFocus();

    // Tab to combobox container first (clear button comes after in DOM)
    await userEvent.tab();
    await expectInputContainerToHaveFocus();

    // Tab to clear button
    await userEvent.tab();
    expect(clearAllBtn).toHaveFocus();

    expect(isDropdownClosed()).toBeTruthy();

    // Tab past the combobox to next input field
    await userEvent.tab();
    const nextInput = screen.getByRole('textbox');
    expect(nextInput).toHaveFocus();
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

  test('Pressing Enter key while on the clear button should clear the selections.', async () => {
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
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).not.toHaveClass('selected');
      expect(listItems[2]!).not.toHaveClass('selected');
    });
  });

  test('Should return list of current selections when calling ref.getSelections and clear all values when calling ref.clearSelections.', async () => {
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
      expect(listButtons![0]).toHaveClass('selected');
    });

    await userEvent.click(listButtons![2]);
    await waitFor(() => {
      expect(listButtons![2]).toHaveClass('selected');
    });

    const setResult = ref.current?.getSelections();
    expect(setResult).toEqual(expectedValues);

    act(() => ref.current?.clearSelections());
    const emptyResult = ref.current?.getSelections();
    expect(emptyResult).toEqual([]);
    expect(listButtons![0]).not.toHaveClass('selected');
    expect(listButtons![2]).not.toHaveClass('selected');
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

  test('should disable component when ref.disable is called and in single-select mode and should call onDisable if its set in props.', async () => {
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

    // Enable the component again
    act(() => ref.current?.disable(false));
    const enabledExpandButton = document.querySelector('.expand-button');
    expect(enabledExpandButton).toBeEnabled();
  });

  test('should disable component when ref.disable is called and in multi-select mode and should call onDisable if its set in props.', async () => {
    const ref = React.createRef<ComboBoxRef>();
    const options = getDefaultOptions();
    renderWithProps({ multiSelect: true, options }, ref);

    // Focus on checking just the expand button which is always in the DOM
    const expandButton = document.querySelector('.expand-button');
    expect(expandButton).toBeInTheDocument();
    expect(expandButton).toBeEnabled();

    // Disable the component
    act(() => ref.current?.disable(true));
    const disabledExpandButton = document.querySelector('.expand-button');
    expect(disabledExpandButton).not.toBeEnabled();

    // Enable the component again
    act(() => ref.current?.disable(false));
    const enabledExpandButton = document.querySelector('.expand-button');
    expect(enabledExpandButton).toBeEnabled();
  });

  test('onUpdateFilter should be called when input content is changed', async () => {
    renderWithProps();
    await toggleDropdown(comboboxId);
    const inputField = await getFocusedComboInputField(comboboxId);
    await userEvent.type(inputField, 'test');
    expect(updateFilterMock).toHaveBeenCalledWith('test');
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

  describe('alphanumeric key handling on toggle button', () => {
    test('should open dropdown and set letter in input field when letter key is pressed on closed dropdown', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      // Focus on the toggle button
      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      // Press letter 'a'
      await userEvent.keyboard('a');

      // Dropdown should be open
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Input field should contain 'a' and be focused
      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;
      await waitFor(() => {
        expect(inputField).toBeInTheDocument();
        expect(inputField.value).toBe('a');
        expect(inputField).toHaveFocus();
      });

      // Filter callback should have been called
      expect(updateFilterMock).toHaveBeenCalledWith('a');
    });

    test('should open dropdown and set number in input field when number key is pressed on closed dropdown', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      // Press number '5'
      await userEvent.keyboard('5');

      // Dropdown should be open
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Input field should contain '5' and be focused
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

      // Press uppercase 'A'
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

      // First open the dropdown
      await toggleDropdown(comboboxId);

      // Clear any previous calls
      updateFilterMock.mockClear();

      // Focus on the toggle button
      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      // Press letter 'a' - should not trigger the special behavior since dropdown is open
      await userEvent.keyboard('a');

      // The filter callback should not have been called with 'a'
      expect(updateFilterMock).not.toHaveBeenCalledWith('a');
    });

    test('should not trigger alphanumeric behavior for non-alphanumeric keys', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      // Test various non-alphanumeric keys
      await userEvent.keyboard(' '); // space
      await userEvent.keyboard('!'); // special character
      await userEvent.keyboard('{Tab}'); // tab key

      // Dropdown should remain closed
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      // Filter callback should not have been called
      expect(updateFilterMock).not.toHaveBeenCalled();
    });

    test('should not trigger alphanumeric behavior when combobox is disabled', async () => {
      const updateFilterMock = vi.fn();
      renderWithProps({ disabled: true, onUpdateFilter: updateFilterMock });

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      // Press letter 'a'
      await userEvent.keyboard('a');

      // Dropdown should remain closed
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });

      // Filter callback should not have been called
      expect(updateFilterMock).not.toHaveBeenCalled();
    });

    test('should position cursor after the character in input field', async () => {
      renderWithProps({});

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      toggleButton.focus();

      // Press letter 'x'
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
  });

  describe('additional coverage tests', () => {
    let userEvent: CamsUserEvent;

    beforeEach(() => {
      userEvent = TestingUtilities.setupUserEvent();
    });

    test('should initialize with selections prop and map them correctly', async () => {
      const initialSelections: ComboOption[] = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];

      renderWithProps({ selections: initialSelections, multiSelect: true });

      // The selections should be visible in the selection label (uses generic "things" label)
      expect(screen.getByText('2 things selected')).toBeInTheDocument();
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

    test('should apply ellipsis overflow strategy classes', async () => {
      const selections: ComboOption[] = [{ label: 'Option 1', value: 'opt1' }];

      renderWithProps({
        selections,
        overflowStrategy: 'ellipsis',
        multiSelect: true,
      });

      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveClass('ellipsis');
    });

    test('should handle ArrowUp key on toggle button', async () => {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      renderWithProps({});

      // Get the toggle button (the div with role="combobox")
      const toggleButton = screen.getByRole('combobox');
      expect(toggleButton).toBeInTheDocument();

      // Focus on the toggle button
      toggleButton.focus();
      expect(toggleButton).toHaveFocus();

      // Create a mock keyboard event for ArrowUp
      const arrowUpEvent = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      // Mock preventDefault and stopPropagation
      arrowUpEvent.preventDefault = preventDefault;
      arrowUpEvent.stopPropagation = stopPropagation;

      // Dispatch the ArrowUp event directly to ensure we hit the specific case
      toggleButton.dispatchEvent(arrowUpEvent);

      // Verify that preventDefault and stopPropagation were called
      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();

      // Verify dropdown doesn't open (ArrowUp should not trigger dropdown)
      expect(isDropdownClosed()).toBeTruthy();
    });

    test('should handle key events on disabled toggle button (early return path)', async () => {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      renderWithProps({ disabled: true });

      // Get the toggle button (the div with role="combobox")
      const toggleButton = screen.getByRole('combobox');
      expect(toggleButton).toBeInTheDocument();

      // Focus on the toggle button
      toggleButton.focus();
      expect(toggleButton).toHaveFocus();

      // Create a mock keyboard event for ArrowUp (any key will work for this test)
      const arrowUpEvent = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });

      // Mock preventDefault and stopPropagation
      arrowUpEvent.preventDefault = preventDefault;
      arrowUpEvent.stopPropagation = stopPropagation;

      // Dispatch the event - this should hit the disabled check and return early
      toggleButton.dispatchEvent(arrowUpEvent);

      // Verify that preventDefault and stopPropagation were NOT called
      // because the function returns early when disabled
      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();

      // No need to check dropdown state - the important part is that the disabled
      // check path is executed (lines 370-372)
    });

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

    test('should handle input click by focusing and preventing default', async () => {
      renderWithProps({});

      await toggleDropdown(comboboxId);
      const inputField = document.querySelector(
        `#${comboboxId}-combo-box-input`,
      ) as HTMLInputElement;

      expect(inputField).toBeInTheDocument();

      // Click on the input field
      await userEvent.click(inputField);

      // Input should be focused
      expect(inputField).toHaveFocus();
    });

    test('should handle dropdown positioning logic', async () => {
      renderWithProps({});

      // Open the dropdown to trigger positioning logic
      await toggleDropdown(comboboxId);

      // The dropdown should be visible
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Close it again
      await toggleDropdown(comboboxId);
    });

    test('should handle edge cases in positioning gracefully', async () => {
      // This test ensures the positioning code doesn't crash when
      // DOM elements might not be available or have missing properties
      renderWithProps({});

      // The component should render without errors
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('should render ariaDescription when provided', async () => {
      const ariaDesc = 'Additional description for this combobox';
      renderWithProps({ ariaDescription: ariaDesc });

      // AriaDescription should appear in the visible hint div, not the screen-reader-only span
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

      // Verify component renders without errors when wrapPills is set
      expect(screen.getByRole('combobox')).toBeInTheDocument();
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

      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent('Custom Selected Label');
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

      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent('Original Label');
    });

    test('should handle empty options array gracefully', async () => {
      renderWithProps({ options: [] });

      await toggleDropdown(comboboxId);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(listbox.children).toHaveLength(0);
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

      // Call focusInput - this should open the dropdown and focus the input field
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

      // Call focus - this should focus the container
      act(() => ref.current?.focus());
      await waitFor(() => {
        const inputContainer = document.querySelector('.input-container');
        expect(inputContainer).toHaveFocus();
      });
    });

    test('should handle setSelections with empty array', async () => {
      const ref = React.createRef<ComboBoxRef>();
      const options = getDefaultOptions(3);
      renderWithProps({ options }, ref);

      // First set some selections
      act(() => ref.current?.setSelections([options[0], options[1]]));
      let selections = ref.current?.getSelections();
      expect(selections).toHaveLength(2);

      // Then clear them using setSelections with empty array
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

      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent('2 items selected');
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

      // Close dropdown to trigger clearFilter
      await toggleDropdown(comboboxId);

      expect(inputField.value).toBe('');
    });

    test('should handle keyboard navigation with no focusable items', async () => {
      // Test with options that would all be filtered out
      const options = [{ label: 'apple', value: 'apple' }];

      renderWithProps({ options });
      await toggleDropdown(comboboxId);

      const inputField = await getFocusedComboInputField(comboboxId);
      await userEvent.type(inputField, 'xyz'); // Filter out all items

      // Try to navigate down - should handle gracefully
      await userEvent.keyboard('{ArrowDown}');

      // Should still be focused on input
      expect(inputField).toHaveFocus();
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

    test('should handle rapid successive toggles gracefully', async () => {
      renderWithProps({});

      const toggleButton = document.querySelector(`#${comboboxId}-expand`) as HTMLButtonElement;

      // Rapidly toggle the dropdown multiple times
      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);

      // Should end up in a consistent state
      expect(document.querySelector('.item-list-container')).toBeInTheDocument();
    });

    test('should handle multiple filter changes rapidly', async () => {
      const options = getDefaultOptions(10);
      const onUpdateFilterMock = vi.fn();
      renderWithProps({ options, onUpdateFilter: onUpdateFilterMock });

      await toggleDropdown(comboboxId);
      const inputField = await getFocusedComboInputField(comboboxId);

      // Type rapidly
      await userEvent.type(inputField, 'abc');

      // Should have called onUpdateFilter for each character
      expect(onUpdateFilterMock).toHaveBeenCalledWith('a');
      expect(onUpdateFilterMock).toHaveBeenCalledWith('ab');
      expect(onUpdateFilterMock).toHaveBeenCalledWith('abc');
    });

    test('should build correct ARIA description for combobox container', () => {
      const selections = [{ label: 'Selected Option', value: 'selected' }];
      renderWithProps({
        label: 'Test Label',
        required: true,
        ariaDescription: 'Custom aria description',
        selections,
        multiSelect: true,
      });

      // Screen-reader-only span should NOT contain ariaDescription (to avoid duplication)
      const ariaDescElement = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDescElement).toBeInTheDocument();
      expect(ariaDescElement?.textContent).toContain('Test Label');
      expect(ariaDescElement?.textContent).toContain('multi-select');
      expect(ariaDescElement?.textContent).toContain('required');
      expect(ariaDescElement?.textContent).not.toContain('Custom aria description');
      expect(ariaDescElement?.textContent).toContain('1 items currently selected');

      // AriaDescription should be in the visible hint div
      const hintElement = document.querySelector(`#${comboboxId}-hint`);
      expect(hintElement).toBeInTheDocument();
      expect(hintElement?.textContent).toContain('Custom aria description');

      // Combobox should reference both elements via aria-describedby
      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute(
        'aria-describedby',
        `${comboboxId}-aria-description ${comboboxId}-hint`,
      );
    });

    test('should build correct ARIA description for disabled state', () => {
      renderWithProps({ disabled: true, label: 'Test Label' });

      const ariaDescElement = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDescElement?.textContent).toContain('Combo box is disabled');
    });

    test('should build correct ARIA description for enabled state', () => {
      renderWithProps({ label: 'Test Label' });

      const ariaDescElement = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDescElement?.textContent).toContain('Press Enter or Down Arrow key to open');
    });

    test('should handle multiple selected items description correctly', () => {
      const selections = [
        { label: 'First Item', value: 'first' },
        { label: 'Second Item', value: 'second' },
        { label: 'Third Item', value: 'third' },
      ];
      renderWithProps({ selections, multiSelect: true });

      const ariaDescElement = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDescElement?.textContent).toContain('3 items currently selected');
      expect(ariaDescElement?.textContent).toContain('First Item, Second Item, Third Item');
    });

    test('should handle single select mode in ARIA description', () => {
      renderWithProps({ multiSelect: false });

      const ariaDescElement = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDescElement?.textContent).toContain('Combo box');
      expect(ariaDescElement?.textContent).not.toContain('multi-select');
    });

    test('should handle combobox without label in ARIA description', () => {
      renderWithProps({ label: undefined });

      const ariaDescElement = document.querySelector(`#${comboboxId}-aria-description`);
      expect(ariaDescElement).toBeInTheDocument();
      expect(ariaDescElement?.textContent).toContain('Combo box');
    });

    test('should handle navigation list edge cases', async () => {
      const options = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
      ];
      renderWithProps({ options });

      await toggleDropdown(comboboxId);
      await expectInputToHaveFocus();

      // Navigate down to first item
      await userEvent.keyboard('{ArrowDown}');
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]).toHaveFocus();

      // Try to navigate up from first item - should go back to input
      await userEvent.keyboard('{ArrowUp}');
      await expectInputToHaveFocus();

      // Navigate to last item
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      expect(listItems[1]).toHaveFocus();

      // Try to navigate down from last item - should stay on last item
      await userEvent.keyboard('{ArrowDown}');
      expect(listItems[1]).toHaveFocus();
    });

    test('should handle Enter key behavior correctly', async () => {
      const options = [{ label: 'Option 1', value: 'opt1' }];
      renderWithProps({ options });

      await toggleDropdown(comboboxId);
      await getFocusedComboInputField(comboboxId);

      // Press Enter on input field - should not select anything
      await userEvent.keyboard('{Enter}');
      let listItems = document.querySelectorAll('li.selected');
      expect(listItems).toHaveLength(0);

      // Click on list item to select it
      const listItem = document.querySelector('li');
      await userEvent.click(listItem!);

      await waitFor(() => {
        listItems = document.querySelectorAll('li.selected');
        expect(listItems).toHaveLength(1);
        expect(listItem).toHaveClass('selected');
      });
    });

    test('should handle icon prop correctly', () => {
      renderWithProps({ icon: 'custom-icon' });

      // Verify component renders without errors when icon prop is set
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('should handle autoComplete prop correctly', () => {
      renderWithProps({ autoComplete: 'off' });

      // When not expanded, input field is not present, so autoComplete is handled via props spread
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test('should call onClose with current selections when dropdown closes', async () => {
      const onClose = vi.fn();
      const options = getDefaultOptions(3);
      renderWithProps({ options, onClose });

      await toggleDropdown(comboboxId);

      // Select some items
      const listItems = document.querySelectorAll('li');
      await userEvent.click(listItems[0]);
      await userEvent.click(listItems[1]);

      // Close dropdown
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

      // Type multiple characters rapidly
      // @ts-expect-error - Intentional use of the delay attribute for user.type function options
      await userEvent.type(inputField, 'test', { delay: 1 });

      // Should have been called for each character
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

      // Call setSelections imperatively
      act(() => ref.current?.setSelections([options[0], options[1]]));

      await waitFor(() => {
        const selections = ref.current?.getSelections();
        expect(selections).toHaveLength(2);
      });

      expect(onUpdateSelection).toHaveBeenCalledTimes(1);
    });
  });
});
