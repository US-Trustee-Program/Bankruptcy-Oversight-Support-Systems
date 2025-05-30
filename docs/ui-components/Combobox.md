# Combobox UI Component

## UX Rules

### Multi-Select Dropdown Combobox

- Height of the dropdown list should be a maximum of 50% of the view height
- If the combo box is above the half-way line of the view, the dropdown list should open downward.
- If the combo box is below the half-way line of the view, the dropdown list should open upward above
    the input field.
- Hovering over items in the dropdown list should highlight them with a light background and a border
    to provide visual feedback.
- Selecting an item in the dropdown list should highlight it with a colored background and border.
    - The color used for highlight must conform with accessibility rules.
    - The color used for highlight should be different from those used for hover.
- A checkmark should be placed on the right side of items which are selected as a selection
    indicator.
- Once an item is selected, a "pill" with the selected label should appear between the combobox
    label and the combobox element.
- The pills should be clickable with an "x" icon on the right and should highlight on hover.
- Clicking on a pill will remove the pill and deselect the associated item in the dropdown list.
- A clear-all button should appear next to the pills
- Clicking the clear-all button should remove all pills and clear all selected items out of the
    dropdown list.
- Clearing all pills should close the dropdown list.
- Hitting the escape key while focused on the input field should close the dropdown list, leave focus on
    the input field, and clear text out of input.
- Clicking outside the combobox should close the dropdown list and clear the input field but should
    NOT focus on the input field.
- Clicking on the toggle button should open or close the dropdown list and put the focus on the
    input field.
- The arrow icon on the toggle button should change directions depending on whether the dropdown
    list is open or closed. It should be pointing down when closed and pointing up when open.
- If the dropdown list is open and the input field is in focus, then pressing the Tab key should
    highlight the first item in the dropdown list. Pressing the tab key a second time should close the
    dropdown and focus on the next element on the screen.
- If the dropdown is already closed, then pressing the tab key should focus on the next element on
    the screen and should not open the dropdown list.
- If the dropdown list is closed, then typing characters on the keyboard should open the dropdown
    list.
- Up and down arrow cursor keys should traverse the list and return to the input field, in either
    direction.
- Pressing the Enter key while focused on an element in the dropdown list should select that option,
    highlight it, place a check next to it, and add a pill for that selected item.
- Pressing the Escape key while focused on an element in the dropdown list should close the dropdown
    list and focus on the input field.
- All pills and items in the dropdown list should use a pointer finger icon when hovering over them.
- Typing text into the input field should filter the dropdown items below the input field.
- Filtered items in the dropdown list should be hidden (display: none), but the arrow keys should
    work as they do when the list is not filtered. Typing down arrow should move from the input field
    to the first unfiltered item in the list or from the last unfiltered item in the list to the input
    field. Likewise, pressing the Up arrow key should move from the first unfiltered item in the list to
    the input field, or from the input field to the last unfiltered item in the list.
- When focus leaves the combobox and moves to another element on screen, the input field in the
    combobox should be cleared.
- Tabbing from another area of the screen to the combo box should first focus on the select item
    pills, then the clear button, then the actual combo box input. If there are no items currently
    selected, then focus should go directly to the combo box input. to the pills, and after traversing
    the pills, should move on to the clear button, and after the clear button, on to the remaining
    components on the screen in their normal traversal order.
- Pressing the Enter key while on the clear button should clear the selections (both the pills and the
    dropdown list selections).
- Pressing the Enter key on a pill should remove the pill and clear associated selection out of the dropdown
    list.
    - If the pill was the last pill in the list, then the focus should go to the previous pill.
    - If the pill was not the last one in the list, then the focus should go to the next pill.
