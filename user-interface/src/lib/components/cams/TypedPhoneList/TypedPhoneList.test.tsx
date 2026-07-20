import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypedPhoneList from './TypedPhoneList';
import { TypedPhoneNumber } from '@common/cams/trustees';

function setup(phones: TypedPhoneNumber[] = [], onChange = vi.fn()) {
  const user = userEvent.setup();
  const { rerender } = render(<TypedPhoneList phones={phones} onChange={onChange} />);
  return { user, onChange, rerender };
}

describe('TypedPhoneList', () => {
  test('renders empty state with enabled "Add phone" button', () => {
    setup([]);
    const addButton = screen.getByRole('button', { name: /add another phone/i });
    expect(addButton).toBeInTheDocument();
    expect(addButton).not.toBeDisabled();
  });

  test('renders provided phones correctly', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222' },
      { type: 'cell', number: '555-333-4444', extension: '99' },
    ];
    setup(phones);
    expect(screen.getByTestId('phone-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('phone-row-1')).toBeInTheDocument();
  });

  test('add phone — calls onChange with new entry using first unused type', async () => {
    const onChange = vi.fn();
    const { user } = setup([], onChange);
    await user.click(screen.getByRole('button', { name: /add another phone/i }));
    expect(onChange).toHaveBeenCalledWith([{ number: '', type: 'direct' }]);
  });

  test('add phone — calls onChange with second unused type when direct is taken', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '555-000-0000' }];
    const { user } = setup(phones, onChange);
    await user.click(screen.getByRole('button', { name: /add another phone/i }));
    expect(onChange).toHaveBeenCalledWith([...phones, { number: '', type: 'cell' }]);
  });

  test('add phone button is disabled when all 3 types are in use', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-000-0001' },
      { type: 'cell', number: '555-000-0002' },
      { type: 'home', number: '555-000-0003' },
    ];
    setup(phones);
    expect(screen.getByRole('button', { name: /add another phone/i })).toBeDisabled();
  });

  test('remove phone — calls onChange with correct entry removed', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-0000' },
      { type: 'cell', number: '555-222-0000' },
    ];
    const { user } = setup(phones, onChange);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([phones[1]]);
  });

  test('remove button is hidden when only one row remains', () => {
    setup([{ type: 'direct', number: '555-000-0000' }]);
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  test('remove button is visible when more than one row exists', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-000-0001' },
      { type: 'cell', number: '555-000-0002' },
    ];
    setup(phones);
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2);
  });

  test('edit number — calls onChange with updated value', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '' }];
    const { user } = setup(phones, onChange);
    const numberInput = screen.getByRole('textbox', { name: /direct phone number/i });
    await user.type(numberInput, '5');
    expect(onChange).toHaveBeenCalled();
  });

  test('edit type — calls onChange with updated type', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '555-000-1111' }];
    const { user } = setup(phones, onChange);
    const typeSelect = screen.getByTestId(/phone-0-type/);
    await user.selectOptions(typeSelect, 'cell');
    expect(onChange).toHaveBeenCalledWith([{ ...phones[0], type: 'cell' }]);
  });

  test('per-row error renders below the correct input', () => {
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: 'bad' }];
    render(
      <TypedPhoneList
        phones={phones}
        onChange={vi.fn()}
        errors={{ 0: { number: ['Invalid phone number'] } }}
      />,
    );
    expect(screen.getByText('Invalid phone number')).toBeInTheDocument();
  });

  test('duplicateTypeError renders below the list when provided', () => {
    render(
      <TypedPhoneList
        phones={[]}
        onChange={vi.fn()}
        duplicateTypeError="Each phone type may only be used once."
      />,
    );
    expect(screen.getByTestId('duplicate-type-error')).toHaveTextContent(
      'Each phone type may only be used once.',
    );
  });
});
