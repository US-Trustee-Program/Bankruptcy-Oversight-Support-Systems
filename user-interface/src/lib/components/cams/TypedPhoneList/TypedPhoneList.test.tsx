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
  test('renders one row for each phone type', () => {
    setup([]);
    expect(screen.getByTestId('phone-row-direct')).toBeInTheDocument();
    expect(screen.getByTestId('phone-row-cell')).toBeInTheDocument();
    expect(screen.getByTestId('phone-row-home')).toBeInTheDocument();
  });

  test('labels each row with the type name', () => {
    setup([]);
    expect(screen.getByLabelText(/direct phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cell phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/home phone number/i)).toBeInTheDocument();
  });

  test('populates inputs from matching phones in props', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222' },
      { type: 'cell', number: '555-333-4444', extension: '99' },
    ];
    setup(phones);
    expect(screen.getByLabelText(/direct phone number/i)).toHaveValue('555-111-2222');
    expect(screen.getByLabelText(/cell phone number/i)).toHaveValue('555-333-4444');
    expect(screen.getByLabelText(/home phone number/i)).toHaveValue('');
  });

  test('does not render dropdown, dividers, or add/remove buttons', () => {
    setup([{ type: 'direct', number: '555-000-0000' }]);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(document.querySelector('.typed-phone-list__divider')).not.toBeInTheDocument();
  });

  test('edit number — calls onChange with all three rows, updated value for the changed type', async () => {
    const onChange = vi.fn();
    const { user } = setup([], onChange);
    const input = screen.getByLabelText(/direct phone number/i);
    await user.type(input, '5');
    expect(onChange).toHaveBeenCalled();
    const lastCall: TypedPhoneNumber[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(3);
    const direct = lastCall.find((p) => p.type === 'direct');
    expect(direct?.number).toMatch(/5/);
  });

  test('edit extension — calls onChange with updated extension for the correct type', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'cell', number: '555-123-4567' }];
    const { user } = setup(phones, onChange);
    const ext = screen.getByLabelText(/cell extension/i);
    await user.type(ext, '42');
    expect(onChange).toHaveBeenCalled();
    const lastCall: TypedPhoneNumber[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const cell = lastCall.find((p) => p.type === 'cell');
    expect(cell?.extension).toMatch(/42/);
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
});
