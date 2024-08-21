import { LegacyRef } from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from './ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const comboboxId = 'test-combobox';

function toggleDropdown(id: string) {
  const toggleButton = document.querySelector(`#${id}-expand`);
  document.querySelector('ul');

  if (!toggleButton) throw new Error('Toggle button could not be found');

  fireEvent.click(toggleButton);
}

function getFocusedComboInputField(id: string): HTMLInputElement {
  const inputField = document.querySelector(`#${id}-combo-box-input`);

  if (!inputField) throw new Error('ComboBox Input field could not be found');

  fireEvent.click(inputField);
  return inputField as HTMLInputElement;
}

function isDropdownClosed() {
  const itemListContainer = document.querySelector('.item-list-container');
  return itemListContainer && itemListContainer.classList.contains('closed');
}

describe('test cams combobox', () => {
  const defaultOptions: ComboOption[] = [];
  for (let i = 0; i < 25; i++) {
    defaultOptions.push({
      label: 'option ' + i,
      value: 'o' + i,
      selected: false,
      hidden: false,
    });
  }

  function renderWithProps(props?: Partial<ComboBoxProps>, ref?: LegacyRef<ComboBoxRef>) {
    const defaultProps: ComboBoxProps = {
      id: comboboxId,
      label: 'Test Combobox',
      ariaLabelPrefix: 'test-combobox',
      options: defaultOptions,
      onUpdateSelection: (_options: ComboOption[]) => {},
      multiSelect: true,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <div>
        <button className="button1" tabIndex={0}>
          button
        </button>

        <ComboBox {...renderProps} ref={ref}></ComboBox>

        <input
          type="text"
          className="input1"
          tabIndex={0}
          value="Some text"
          onChange={() => {}}
        ></input>
      </div>,
    );
  }

  test('Clicking on the toggle button should open or close the dropdown list and put the focus on the input field.  When closed it should call onClose()', async () => {
    const onClose = vi.fn();

    renderWithProps({ onClose });

    toggleDropdown(comboboxId);

    expect(isDropdownClosed()).toBeFalsy();

    const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    expect(inputField).toHaveFocus();

    toggleDropdown(comboboxId);

    expect(isDropdownClosed()).toBeTruthy();

    expect(inputField).toHaveFocus();

    expect(onClose).toHaveBeenCalled();
  });

  test('Should deselect the item when you click on a selected item', async () => {
    renderWithProps();

    toggleDropdown(comboboxId);

    const firstListItemButton = document.querySelector('li button');
    fireEvent.click(firstListItemButton!);

    let selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toBe(1);

    fireEvent.click(firstListItemButton!);

    selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toEqual(0);
  });

  test('Should call onPillSelection when a pill is clicked', async () => {
    const onPillSelection = vi.fn();

    renderWithProps({ onPillSelection });

    toggleDropdown(comboboxId);

    const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    expect(inputField).toHaveFocus();

    toggleDropdown(comboboxId);

    const firstListItemButton = document.querySelectorAll('li button');
    fireEvent.click(firstListItemButton![0]);

    const pill = document.querySelector(`#pill-${comboboxId}-pill-box-0`);
    fireEvent.click(pill!);

    await waitFor(() => {
      expect(onPillSelection).toHaveBeenCalled();
    });
  });

  test('After selecting an item in the dropdown list, a pill should appear, and after clicking the pill it should remove pill and deselect item in dropdown', async () => {
    renderWithProps();

    let pillBox = document.querySelector(`#${comboboxId}-pill-box`);
    expect(pillBox!.children.length).toEqual(0);

    toggleDropdown(comboboxId);

    const firstListItemButton = document.querySelector('li button');
    fireEvent.click(firstListItemButton!);

    await waitFor(() => {
      pillBox = document.querySelector(`#${comboboxId}-pill-box`);
      expect(pillBox!.children.length).toEqual(1);
    });

    let selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toBe(1);

    fireEvent.click(pillBox!.children[0]);

    waitFor(() => {
      pillBox = document.querySelector(`#${comboboxId}-pill-box`);
      expect(pillBox!.children.length).toEqual(0);
    });

    selectedListItem = document.querySelectorAll('li.selected');
    expect(selectedListItem!.length).toEqual(0);
  });

  test('Should contain a clear button when pills are present and clicking button should remove all selections and close dropdown list', async () => {
    renderWithProps();

    toggleDropdown(comboboxId);

    const firstListItemButton = document.querySelectorAll('li button');
    fireEvent.click(firstListItemButton![0]);

    const clearButton = document.querySelector('.pill-clear-button');
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(firstListItemButton![1]);
    fireEvent.click(firstListItemButton![2]);

    const pillBox = document.querySelector(`#${comboboxId}-pill-box`);
    expect(pillBox!.children.length).toEqual(3);

    fireEvent.click(clearButton!);
    expect(pillBox!.children.length).toEqual(0);
  });

  test('should close dropdown list, clear input field, and focus on input field when escape key is pressed inside the input field', () => {
    renderWithProps();

    const inputField = getFocusedComboInputField(comboboxId);

    fireEvent.change(inputField, { target: { value: 'test input' } });
    expect(inputField.value).toEqual('test input');
    expect(isDropdownClosed()).toBeFalsy();

    fireEvent.keyDown(inputField, { key: 'Escape' });
    expect(inputField.value).toEqual('');
    expect(isDropdownClosed()).toBeTruthy();
    expect(inputField).toHaveFocus();
  });

  test('should close dropdown list, clear input field, but NOT focus on input field when clicking outside of combobox', () => {
    renderWithProps();

    const comboboxInputField = getFocusedComboInputField(comboboxId);
    const otherInput = document.querySelector('.input1');

    fireEvent.change(comboboxInputField, { target: { value: 'test input' } });
    expect(isDropdownClosed()).toBeFalsy();

    fireEvent.click(otherInput!);

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

    toggleDropdown(comboboxId);
    await waitFor(() => {
      const toggleIcon = document.querySelector('.expand-button svg use');
      const attributeValue = toggleIcon?.getAttribute('xlink:href');
      const containsValueLess = attributeValue?.indexOf('expand_less');
      expect(containsValueLess).toBeGreaterThan(-1);
    });

    toggleDropdown(comboboxId);
    await waitFor(() => {
      const toggleIcon = document.querySelector('.expand-button svg use');
      const attributeValue = toggleIcon?.getAttribute('xlink:href');
      containsValueMore = attributeValue?.indexOf('expand_more');
      expect(containsValueMore).toBeGreaterThan(-1);
    });
  });

  test('If the dropdown list is open, and the input field is in focus, then pressing the Tab key should highlight the first item in the dropdown list. Pressing the tab key a second time should close the dropdown and focus on the next element on the screen.', async () => {
    renderWithProps();

    const comboboxInputField = getFocusedComboInputField(comboboxId);
    expect(isDropdownClosed()).toBeFalsy();

    fireEvent.keyDown(comboboxInputField, { key: 'Tab' });

    const listItem = document.querySelector('li button');
    await waitFor(() => {
      expect(listItem).toHaveFocus();
    });
    expect(isDropdownClosed()).toBeFalsy();

    await userEvent.tab();

    await waitFor(() => {
      expect(isDropdownClosed()).toBeTruthy();
      const input1 = document.querySelector('.input1');
      expect(input1).toHaveFocus();
    });
  });

  test('If the dropdown is already closed, then pressing the tab key should focus on the next element on the screen and should not open the dropdown list.', async () => {
    renderWithProps();

    const otherButton = document.querySelector('.button1');
    const otherInput = document.querySelector('.input1');
    const comboboxInputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    (otherButton as HTMLButtonElement)!.focus();
    expect(otherButton!).toHaveFocus();
    await userEvent.tab();
    await waitFor(() => {
      expect(comboboxInputField!).toHaveFocus();
    });
    expect(isDropdownClosed()).toBeTruthy();

    await userEvent.tab();
    expect(otherInput!).toHaveFocus();
  });

  test('If the dropdown is open, and gibberish is typed into input field, the filtered results should have length of 0, and pressing tab should tab out of the combobox to the next input field.', async () => {
    const ref = React.createRef<ComboBoxRef>();
    renderWithProps({}, ref);

    const otherInput = document.querySelector('.input1');
    const comboboxInputField = getFocusedComboInputField(comboboxId);

    fireEvent.change(comboboxInputField, { target: { value: 'this is gibberish' } });
    comboboxInputField.focus();
    const result = ref.current?.getValue();
    expect(result).toEqual([]);

    await userEvent.tab();
    await waitFor(() => {
      expect(otherInput!).toHaveFocus();
    });
    expect(isDropdownClosed()).toBeTruthy();
  });

  test('If the dropdown list is closed, then typing characters on the keyboard should open the dropdown list', async () => {
    renderWithProps();

    const inputField = getFocusedComboInputField(comboboxId);
    fireEvent.keyDown(inputField, { key: 'Escape' });
    expect(isDropdownClosed()).toBeTruthy();

    fireEvent.change(inputField, { target: { value: 'test input' } });
    expect(isDropdownClosed()).toBeFalsy();
  });

  test('Up and down arrow cursor keys should traverse the list and return to the input field, in either direction, skipping list items with the hidden class', async () => {
    const options = [
      { label: 'option1', value: 'option1', selected: false },
      { label: 'option2', value: 'option2', selected: false, hidden: true },
      { label: 'option3', value: 'option3', selected: false, hidden: true },
      { label: 'option4', value: 'option4', selected: false },
      { label: 'option5', value: 'option5', selected: false },
    ];
    renderWithProps({ options });

    const inputField = getFocusedComboInputField(comboboxId);
    fireEvent.keyDown(inputField, { key: 'ArrowDown' });

    const listItems = document.querySelectorAll('li button');
    expect(listItems[0]).toHaveFocus();
    expect(listItems[0]).toHaveAttribute('data-value', 'option1');

    fireEvent.keyDown(listItems[0]!, { key: 'ArrowDown' });
    expect(listItems[3]).toHaveFocus();
    expect(listItems[3]).toHaveAttribute('data-value', 'option4');

    fireEvent.keyDown(listItems[3]!, { key: 'ArrowDown' });
    expect(listItems[4]).toHaveFocus();
    expect(listItems[4]).toHaveAttribute('data-value', 'option5');

    fireEvent.keyDown(listItems[4]!, { key: 'ArrowDown' });
    expect(inputField).toHaveFocus();

    fireEvent.keyDown(inputField, { key: 'ArrowUp' });
    expect(listItems[4]).toHaveFocus();

    fireEvent.keyDown(listItems[4]!, { key: 'ArrowUp' });
    expect(listItems[3]).toHaveFocus();

    fireEvent.keyDown(listItems[3]!, { key: 'ArrowUp' });
    expect(listItems[0]).toHaveFocus();

    fireEvent.keyDown(listItems[0]!, { key: 'ArrowUp' });
    expect(inputField).toHaveFocus();
  });

  test('Pressing Enter key while focused on an element in the dropdown list should select that option, and add a pill for that selected item.', async () => {
    const options = [
      { label: 'option1', value: 'option1', selected: false },
      { label: 'option2', value: 'option2', selected: false },
    ];
    renderWithProps({ options });

    const pillBox = document.querySelector(`#${comboboxId}-pill-box`);
    expect(pillBox!.children.length).toEqual(0);

    const inputField = getFocusedComboInputField(comboboxId);
    fireEvent.keyDown(inputField, { key: 'ArrowDown' });

    const listItems = document.querySelectorAll('li');
    const listItem0Button = listItems![0].children[0];
    expect(listItem0Button).toHaveFocus();

    fireEvent.keyDown(listItem0Button, { key: 'Enter' });

    await waitFor(() => {
      expect(listItems![0]).toHaveClass('selected');
    });

    expect(pillBox!.children.length).toEqual(1);

    const listItemValue = listItem0Button.attributes.getNamedItem('data-value');
    const pillValue = pillBox!.children[0].attributes.getNamedItem('data-value');
    expect(pillValue).toEqual(listItemValue);
  });

  test('Pressing Escape key while focused on an element in the dropdown list should close the dropdown list and focus on the input field.', async () => {
    const options = [
      { label: 'option1', value: 'option1', selected: false },
      { label: 'option2', value: 'option2', selected: false },
    ];
    renderWithProps({ options });

    const inputField = getFocusedComboInputField(comboboxId);
    fireEvent.keyDown(inputField, { key: 'ArrowDown' });
    expect(isDropdownClosed()).toBeFalsy();

    const listItems = document.querySelectorAll('li');
    const listItem0Button = listItems![0].children[0];
    expect(listItem0Button).toHaveFocus();

    fireEvent.keyDown(listItem0Button, { key: 'Escape' });
    expect(isDropdownClosed()).toBeTruthy();
    expect(inputField).toHaveFocus();
  });

  test('Typing text into the input field should filter the dropdown items below the input field.', async () => {
    const options = [
      { label: 'my dog is red', value: 'val0', selected: false, hidden: false },
      { label: 'your cat is red', value: 'val1', selected: false, hidden: false },
      { label: 'you are blue', value: 'val2', selected: false, hidden: false },
      { label: 'blue is water', value: 'val3', selected: false, hidden: false },
      { label: 'everything blue', value: 'val4', selected: false, hidden: false },
    ];
    renderWithProps({ options });

    const inputField = getFocusedComboInputField(comboboxId);
    fireEvent.change(inputField, { target: { value: 'blue' } });

    const listItems = document.querySelectorAll('li');
    expect(listItems[0]).toHaveClass('hidden');
    expect(listItems[1]).toHaveClass('hidden');
    for (let i = 2; i < listItems.length; i++) {
      expect(listItems[i]).not.toHaveClass('hidden');
    }

    fireEvent.change(inputField, { target: { value: 'everything' } });
    for (let i = 0; i < listItems.length - 1; i++) {
      expect(listItems[i]).toHaveClass('hidden');
    }
    expect(listItems[4]).not.toHaveClass('hidden');
  });

  test('When focus leaves the combobox and moves to another element on screen, the input field in the combobox should be cleared.', async () => {
    const options = [
      { label: 'option1', value: 'option1', selected: false },
      { label: 'option2', value: 'option2', selected: false },
    ];
    renderWithProps({ options });

    const input1 = document.querySelector('.input1');
    const inputField = getFocusedComboInputField(comboboxId);

    fireEvent.change(inputField, { target: { value: 'test test' } });

    inputField.focus();
    userEvent.tab();

    await waitFor(() => {
      expect(inputField.value).toEqual('');
      expect(input1!).toHaveFocus();
    });
  });

  test('Tabbing from another area of the screen to the combo box should first focus on the pills, then the clear button, then the actual combo box input.', async () => {
    renderWithProps();

    const comboInput = getFocusedComboInputField(comboboxId);
    const expandButton = document.querySelector('.expand-button');
    const pillBox = document.querySelector(`#${comboboxId}-pill-box`);
    const button1 = document.querySelector('.button1');
    const input1 = document.querySelector('.input1');
    const firstListItemButton = document.querySelectorAll('li button');
    fireEvent.click(firstListItemButton![0]);
    fireEvent.click(firstListItemButton![1]);
    fireEvent.click(firstListItemButton![2]);

    // this shouldn't be necessary as we've tested this elsewhere, but the dropdown isn't closing when clicking on button1
    // so we're forcing closed.
    fireEvent.click(expandButton!);
    await waitFor(() => {
      expect(isDropdownClosed()).toBeTruthy();
    });

    fireEvent.click(button1!);
    (button1! as HTMLButtonElement).focus();
    expect(button1!).toHaveFocus();

    await userEvent.tab();
    expect(isDropdownClosed()).toBeTruthy();

    await waitFor(() => {
      expect(pillBox!.children[0]).toHaveFocus();
    });

    await userEvent.tab();

    await waitFor(() => {
      expect(pillBox!.children[1]).toHaveFocus();
    });

    await userEvent.tab();

    await waitFor(() => {
      expect(pillBox!.children[2]).toHaveFocus();
    });

    const pillClearButton = document.querySelector('.pill-clear-button');

    await userEvent.tab();

    await waitFor(() => {
      expect(pillClearButton).toHaveFocus();
    });

    await userEvent.tab();

    await waitFor(() => {
      expect(comboInput).toHaveFocus();
    });

    await userEvent.tab();

    await waitFor(() => {
      expect(input1).toHaveFocus();
    });
  });

  test('should return selections in onUpdateSelection when a selection is made', async () => {
    const updateSelection = vi.fn();
    const results = [defaultOptions[0]];
    renderWithProps({ onUpdateSelection: updateSelection });

    getFocusedComboInputField(comboboxId);
    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);

    expect(updateSelection).toHaveBeenCalledWith(results);
  });

  test('clicking or selecting pill when in single-select mode, should clear the selections', async () => {
    const ref = React.createRef<ComboBoxRef>();
    const updateSelection = vi.fn();
    const pillSelection = vi.fn();
    renderWithProps(
      {
        multiSelect: false,
        onUpdateSelection: updateSelection,
        onPillSelection: pillSelection,
      },
      ref,
    );

    getFocusedComboInputField(comboboxId);
    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);
    fireEvent.click(listButtons![1]);
    fireEvent.click(listButtons![2]);

    await waitFor(() => {
      const selections = ref.current?.getValue();
      expect(selections!.length).toEqual(1);

      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).not.toHaveClass('selected');
      expect(listItems[2]!).toHaveClass('selected');
    });

    const pill = document.querySelector('#pill-test-combobox');
    expect(pill!).toBeInTheDocument();
    (pill! as HTMLButtonElement).focus();

    fireEvent.keyDown(pill!, { key: 'Enter', keyCode: 13 });
    expect(updateSelection).toHaveBeenCalledWith([]);
    expect(pillSelection).toHaveBeenCalledWith([]);

    await waitFor(() => {
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).not.toHaveClass('selected');
      expect(listItems[2]!).not.toHaveClass('selected');

      const selections = ref.current?.getValue();
      expect(selections!.length).toEqual(0);
    });
  });

  test('Pressing Enter key while on the clear button should clear the selections (both the pills and the dropdown list selections).', async () => {
    const updateSelection = vi.fn();
    renderWithProps({ onUpdateSelection: updateSelection });

    getFocusedComboInputField(comboboxId);
    const pillBox = document.querySelector(`#${comboboxId}-pill-box`);
    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);
    fireEvent.click(listButtons![1]);
    fireEvent.click(listButtons![2]);

    expect(pillBox?.children.length).toEqual(3);

    const clearButton = document.querySelector('.pill-clear-button');
    expect(clearButton!).toBeInTheDocument();
    (clearButton! as HTMLButtonElement).focus();

    fireEvent.keyDown(clearButton!, { key: 'Enter', keyCode: 13 });
    expect(updateSelection).toHaveBeenCalledWith([]);

    await waitFor(() => {
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).not.toHaveClass('selected');
      expect(listItems[2]!).not.toHaveClass('selected');

      expect(pillBox?.children.length).toEqual(0);
    });
  });

  test('Should clear the pill and selection when Enter is pressed on a pill. If it is the last pill focus goes to the pill before it, otherwise it goes to the pill after it. If it is the only pill the dropdown is closed.', async () => {
    const updateSelection = vi.fn();
    renderWithProps({ onUpdateSelection: updateSelection });

    const pillBox = document.querySelector(`#${comboboxId}-pill-box`);
    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);
    fireEvent.click(listButtons![1]);
    fireEvent.click(listButtons![2]);

    expect(pillBox?.children.length).toEqual(3);

    const button1 = document.querySelector('.button1');
    (button1! as HTMLButtonElement).focus();

    fireEvent.keyDown(button1!, { key: 'Tab' });
    fireEvent.keyDown(pillBox!.children[0], { key: 'Enter' });

    await waitFor(() => {
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).toHaveClass('selected');
      expect(listItems[2]!).toHaveClass('selected');

      expect(pillBox?.children.length).toEqual(2);
      expect(pillBox!.children[0]).toHaveFocus();
    });

    fireEvent.keyDown(pillBox!.children[0], { key: 'Tab' });
    fireEvent.keyDown(pillBox!.children[1], { key: 'Enter' });

    await waitFor(() => {
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).toHaveClass('selected');
      expect(listItems[2]!).not.toHaveClass('selected');

      expect(pillBox?.children.length).toEqual(1);
      expect(pillBox!.children[0]).toHaveFocus();
    });

    fireEvent.keyDown(pillBox!.children[0], { key: 'Enter' });
    await waitFor(() => {
      const listItems = document.querySelectorAll('li');
      expect(listItems[0]!).not.toHaveClass('selected');
      expect(listItems[1]!).not.toHaveClass('selected');
      expect(listItems[2]!).not.toHaveClass('selected');

      expect(pillBox?.children.length).toEqual(0);
      expect(isDropdownClosed()).toBeTruthy();
    });
  });

  test('options hidden by being filtered out should have "hidden" css class', () => {
    const ref = React.createRef<ComboBoxRef>();

    const options = [
      {
        label: 'option 0',
        value: 'o0',
        selected: false,
        hidden: false,
      },
      {
        label: 'option 1',
        value: 'o1',
        selected: false,
        hidden: true,
      },
      {
        label: 'option 2',
        value: 'o2',
        selected: false,
        hidden: true,
      },
      {
        label: 'option 3',
        value: 'o3',
        selected: false,
        hidden: false,
      },
    ];

    renderWithProps({ options }, ref);

    const listItems = document.querySelectorAll('li');
    for (let i = 0; i < options.length; i++) {
      if (options[i].hidden === true) {
        expect(listItems[i]).toHaveClass('hidden');
      } else {
        expect(listItems[i]).not.toHaveClass('hidden');
      }
    }
  });

  test('Should return list of current selections when calling ref.getValue and clear all values when calling ref.clearValue.', async () => {
    const ref = React.createRef<ComboBoxRef>();
    const options = [
      {
        label: 'option 0',
        value: 'o0',
        selected: false,
        hidden: false,
      },
      {
        label: 'option 1',
        value: 'o1',
        selected: false,
        hidden: true,
      },
    ];

    renderWithProps({ options }, ref);

    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);
    fireEvent.click(listButtons![1]);

    const setResult = ref.current?.getValue();
    expect(setResult).toEqual(options);

    const clearedResult = ref.current?.clearValue();
    expect(clearedResult).toEqual(undefined);
  });

  test('should disable component when ref.disable is called and in single-select mode', async () => {
    const ref = React.createRef<ComboBoxRef>();
    renderWithProps({ multiSelect: false }, ref);

    const input = document.querySelector('.combo-box-input');
    expect(input).toBeInTheDocument();

    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);

    const pill = document.querySelector('.pill');
    const expandButton = document.querySelector('.expand-button');

    expect(input).not.toBeInTheDocument();
    expect(expandButton).toBeEnabled();
    expect(pill).toBeEnabled();

    ref.current?.disable(true);

    await waitFor(() => {
      expect(expandButton).not.toBeEnabled();
      expect(pill).not.toBeEnabled();
    });

    ref.current?.disable(false);

    await waitFor(() => {
      expect(expandButton).toBeEnabled();
      expect(pill).toBeEnabled();
    });
  });

  test('should disable component when ref.disable is called and in multi-select mode', async () => {
    const ref = React.createRef<ComboBoxRef>();
    renderWithProps({ multiSelect: true }, ref);

    const listButtons = document.querySelectorAll('li button');
    fireEvent.click(listButtons![0]);
    fireEvent.click(listButtons![1]);

    // pillbox, pills, clear all button, single-select pill, input, expand button
    const pills = document.querySelectorAll('.pill');
    const clearAllButton = document.querySelector('.pill-clear-button');
    const input = document.querySelector('.combo-box-input');
    const expandButton = document.querySelector('.expand-button');

    expect(clearAllButton).toBeEnabled();
    expect(input).toBeEnabled();
    expect(expandButton).toBeEnabled();
    pills.forEach((pill) => {
      expect(pill).toBeEnabled();
    });

    ref.current?.disable(true);

    await waitFor(() => {
      expect(clearAllButton).not.toBeEnabled();
      expect(input).not.toBeEnabled();
      expect(expandButton).not.toBeEnabled();
      pills.forEach((pill) => {
        expect(pill).not.toBeEnabled();
      });
    });

    ref.current?.disable(false);

    await waitFor(() => {
      expect(clearAllButton).toBeEnabled();
      expect(input).toBeEnabled();
      expect(expandButton).toBeEnabled();
      pills.forEach((pill) => {
        expect(pill).toBeEnabled();
      });
    });
  });
});
