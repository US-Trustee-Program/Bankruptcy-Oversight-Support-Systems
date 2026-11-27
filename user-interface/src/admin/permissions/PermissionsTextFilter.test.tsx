import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PermissionsTextFilter } from './PermissionsTextFilter';

// The field holds no text of its own; this host keeps the value, as the Permissions screens do.
function Host({
  initial = '',
  onChange,
}: {
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PermissionsTextFilter
      id="name-filter"
      label="CAMS User Name"
      placeholder="Search by name"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

// Found by its label, which also checks the label is tied to the input.
const input = () => screen.getByLabelText('CAMS User Name');
// Screens and their tests find Clear by its id, `<id>-clear`.
const clear = () => document.querySelector<HTMLButtonElement>('#name-filter-clear');

describe('PermissionsTextFilter', () => {
  test('should label the field, show its placeholder, and turn off autocomplete', () => {
    render(<Host />);

    expect(input()).toHaveAttribute('id', 'name-filter');
    expect(input()).toHaveAttribute('placeholder', 'Search by name');
    expect(input()).toHaveAttribute('autocomplete', 'off');
  });

  test('should report each change and offer Clear only while the field has text', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    expect(clear()).not.toBeInTheDocument();

    await userEvent.type(input(), 'Sa');

    expect(onChange).toHaveBeenNthCalledWith(1, 'S');
    expect(onChange).toHaveBeenNthCalledWith(2, 'Sa');
    expect(input()).toHaveValue('Sa');
    expect(clear()).toHaveAccessibleName('Clear CAMS User Name filter');
  });

  test('should empty the field and keep focus in it when Clear is pressed', async () => {
    const onChange = vi.fn();
    render(<Host initial="Sarah" onChange={onChange} />);
    expect(clear()).toBeInTheDocument();

    await userEvent.click(clear()!);

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    expect(input()).toHaveValue('');
    // Clear disappears with the text, so focus returns to the field instead of being lost.
    expect(clear()).not.toBeInTheDocument();
    expect(input()).toHaveFocus();
  });
});
