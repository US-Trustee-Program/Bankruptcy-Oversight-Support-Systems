import React, { LegacyRef } from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from './ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import testingUtilities from '@/lib/testing/testing-utilities';

const comboboxId = 'test-combobox';

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
  let defaultOptions: ComboOption[] = [];
  const updateFilterMock = vi.fn();

  const renderWithProps = (props?: Partial<ComboBoxProps>, ref?: LegacyRef<ComboBoxRef>) => {
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

      await testingUtilities.toggleComboBoxItemSelection(comboboxId, 0);

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

  test('Tabbing from another area of the screen to the combo box should first focus on the clear button, then the actual combo box input.', async () => {
    const ref = React.createRef<ComboBoxRef>();
    renderWithProps({ options: getDefaultOptions() }, ref);
    await toggleDropdown();

    const button1 = document.querySelector('.button1');

    await testingUtilities.toggleComboBoxItemSelection(comboboxId, 0);
    await testingUtilities.toggleComboBoxItemSelection(comboboxId, 1);
    await testingUtilities.toggleComboBoxItemSelection(comboboxId, 2);

    const selectedList = ref.current!.getSelections();
    expect(selectedList.length).toEqual(3);
    const clearAllBtn = getClearAllButton();
    expect(clearAllBtn).toBeInTheDocument();

    // this shouldn't be necessary as we've tested this elsewhere, but the dropdown isn't closing when clicking on button1
    // so we're forcing closed.
    toggleDropdown();
    await waitFor(() => {
      expect(isDropdownClosed()).toBeTruthy();
    });

    await userEvent.click(button1!);
    await waitFor(() => {
      expect(button1!).toHaveFocus();
    });

    await waitFor(async () => {
      await userEvent.tab();
      expect(clearAllBtn).toHaveFocus();
    });

    await waitFor(async () => {
      await userEvent.type(clearAllBtn!, '{Tab}');
      await expectInputContainerToHaveFocus();
    });

    expect(isDropdownClosed()).toBeTruthy();
    const container = await getComboInputContainer();

    await userEvent.tab();

    await waitFor(() => {
      expect(container).not.toHaveFocus();
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

    ref.current?.clearSelections();

    await waitFor(() => {
      const emptyResult = ref.current?.getSelections();
      expect(emptyResult).toEqual([]);
      expect(listButtons![0]).not.toHaveClass('selected');
      expect(listButtons![2]).not.toHaveClass('selected');
    });
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

    ref.current?.setSelections(options);

    await waitFor(() => {
      selections = ref.current?.getSelections();
      expect(selections).toEqual(options.map((option) => ({ ...option })));
    });
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

    ref.current?.disable(true);

    await waitFor(() => {
      const disabledExpandButton = document.querySelector('.expand-button');
      expect(disabledExpandButton).not.toBeEnabled();
    });

    // Enable the component again
    ref.current?.disable(false);

    // Check that the expand button is enabled again
    await waitFor(() => {
      const enabledExpandButton = document.querySelector('.expand-button');
      expect(enabledExpandButton).toBeEnabled();
    });
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
    ref.current?.disable(true);

    // Check that the expand button is disabled
    await waitFor(() => {
      const disabledExpandButton = document.querySelector('.expand-button');
      expect(disabledExpandButton).not.toBeEnabled();
    });

    // Enable the component again
    ref.current?.disable(false);

    // Check that the expand button is enabled again
    await waitFor(() => {
      const enabledExpandButton = document.querySelector('.expand-button');
      expect(enabledExpandButton).toBeEnabled();
    });
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
});
