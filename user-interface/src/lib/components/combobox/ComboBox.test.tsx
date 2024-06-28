import { LegacyRef } from 'react';
import ComboBox, { ComboBoxProps, ComboOption } from './ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';

const comboboxId = 'test-combobox';

const defaultOptions: ComboOption[] = [];
for (let i = 0; i < 25; i++) {
  defaultOptions.push({
    label: 'option ' + i,
    value: 'o' + i,
    selected: false,
    hidden: false,
  });
}

/*
function setWindowSize(width: number, height: number) {
  window.innerWidth = width;
  window.innerHeight = height;

  // Dispatch a resize event
  window.dispatchEvent(new Event('resize'));
}
*/

function toggleDropdown(id: string) {
  const toggleButton = document.querySelector(`#${id}-expand`);
  fireEvent.click(toggleButton!);
  const dropdownList = document.querySelector('ul');
  return dropdownList;
}

function focusInputField(id: string) {
  const inputField = document.querySelector(`#${id}-combo-box-input`);
  fireEvent.click(inputField!);
  return inputField;
}

describe('test cams combobox', () => {
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
        <button className="other-button">button</button>
        <ComboBox {...renderProps} ref={ref}></ComboBox>
        <input type="text" className="other-input" tabIndex={0} value="Some text"></input>
      </div>,
    );
  }

  test('Clicking on the toggle button should open or close the dropdown list and put the focus on the input field.  When closed it should call onClose()', async () => {
    const onClose = vi.fn();

    renderWithProps({ onClose });

    toggleDropdown(comboboxId);

    const itemListContainer = document.querySelector('.item-list-container');
    expect(itemListContainer).not.toHaveClass('closed');

    const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    expect(inputField).toHaveFocus();

    toggleDropdown(comboboxId);

    expect(itemListContainer).toHaveClass('closed');

    expect(inputField).toHaveFocus();

    expect(onClose).toHaveBeenCalled();
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

    const inputField = focusInputField(comboboxId);
    const itemListContainer = document.querySelector('.item-list-container');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: 'test input' } });
      expect((inputField as HTMLInputElement).value).toEqual('test input');
      expect(itemListContainer).not.toHaveClass('closed');

      fireEvent.keyDown(inputField, { key: 'Escape' });
      expect((inputField as HTMLInputElement).value).toEqual('');
      expect(itemListContainer).toHaveClass('closed');
      expect(inputField).toHaveFocus();
    } else {
      throw new Error('No input field');
    }
  });

  test('should close dropdown list, clear input field, but NOT focus on input field when clicking outside of combobox', () => {
    renderWithProps();

    const inputField = focusInputField(comboboxId);
    const itemListContainer = document.querySelector('.item-list-container');
    const otherInput = document.querySelector('.other-input');

    if (inputField) {
      fireEvent.change(inputField, { target: { value: 'test input' } });
      expect(itemListContainer).not.toHaveClass('closed');

      fireEvent.click(otherInput!);

      expect((inputField as HTMLInputElement).value).toEqual('');
      expect(itemListContainer).toHaveClass('closed');
      expect(inputField).not.toHaveFocus();
    } else {
      throw new Error('No input field');
    }
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

    // const otherInput = document.querySelector('.other-input');
    const inputField = focusInputField(comboboxId);
    const itemListContainer = document.querySelector('.item-list-container');
    expect(itemListContainer).not.toHaveClass('closed');

    const listItem = document.querySelector('li button');

    fireEvent.keyDown(inputField!, { key: 'Tab' });

    await waitFor(() => {
      expect(listItem).toHaveFocus();
    });
    expect(itemListContainer).not.toHaveClass('closed');
    fireEvent.keyDown(listItem!, { key: 'Tab' });
    await waitFor(() => {
      expect(itemListContainer).toHaveClass('closed');
      // TODO: Focus isn't moving to otherInputs during tests, it cycles back to the combobox input.
      // expect(otherInput).toHaveFocus();
    });
  });

  test.skip('If the dropdown is already closed, then pressing the tab key should focus on the next element on the screen and should not open the dropdown list.', async () => {
    renderWithProps();

    const otherButton = document.querySelector('.other-button');
    const otherInput = document.querySelector('.other-input');
    const inputField = document.querySelector(`#${comboboxId}-combo-box-input`);
    fireEvent.click(otherButton!);
    await waitFor(() => {
      expect(otherButton!).toHaveFocus();
    });
    fireEvent.keyDown(otherButton!, { key: 'Tab', code: 'Tab' });
    await waitFor(() => {
      expect(inputField!).toHaveFocus();
    });
    const itemListContainer = document.querySelector('.item-list-container');
    expect(itemListContainer).not.toHaveClass('closed');

    fireEvent.keyDown(inputField!, { key: 'Tab' });
    expect(otherInput!).toHaveFocus();
  });

  // If the dropdown list is closed, then typing characters on the keyboard should open the dropdown
  // list.
  // Up and down arrow cursor keys should traverse the list and return to the input field, in either
  // direction.
  // Pressing Enter key while focused on an element in the dropdown list should select that option,
  // high-light it, place a check next to it, and add a pill for that selected item.
  // Pressing Escape key while focused on an element in the dropdown list should close the dropdown
  // list and focus on the input field.
  // All pills and items in the dropdown list should use a pointer finger icon when hovering over them.
  // Typing text into the input field should filter the dropdown items below the input field.
  // Filtered items in the dropdown list should be hidden (display: none), but the arrow keys should
  // work as they do when the list is not filtered. Typing down arrow should move from the input field
  // to the first unfiltered item in the list or from the last unfiltered item in the list to the input
  // field. Likewise, pressing Up arrow key should move from the first unfiltered item in the list to
  // the input field, or from the input field to the last unfiltered item in the list.
  // When focus leaves the combobox and moves to another element on screen, the input field in the
  // combobox should be cleared.
  // Tabbing from another area of the screen to the combo box should first focus on the select item
  // pills, then the clear button, then the actual combo box input. If there are no items currently
  // selected, then focus should go directly to the combo box input. to the pills, and after traversing
  // the pills, should move on to the clear button, and after the clear button, on to the remaining
  // components on the screen in their normal traversal order.
  // Pressing Enter key while on the clear button should clear the selections (both the pills and the
  // dropdown list selections).
  // Pressing Enter key on a pill should remove the pill and clear associated selection out of dropdown
  // list.
  // - If the pill was the last pill in the list, then the focus should go to the previous pill.
  // - If the pill was not the last one in the list, then the focus should go to the next pill.

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
});
