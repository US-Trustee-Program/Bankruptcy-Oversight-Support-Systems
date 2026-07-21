import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypedPhoneList from './TypedPhoneList';
import { PhoneType, TypedPhoneNumber } from '@common/cams/trustees';

function getPhoneNumberInput(type: PhoneType): HTMLInputElement {
  return document.querySelector(`[data-testid$="-phone-${type}-number"]`) as HTMLInputElement;
}

function getPhoneExtensionInput(type: PhoneType): HTMLInputElement {
  return document.querySelector(`[data-testid$="-phone-${type}-extension"]`) as HTMLInputElement;
}

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
    expect(getPhoneNumberInput('direct')).toHaveAttribute('aria-label', 'Direct phone number');
    expect(getPhoneNumberInput('cell')).toHaveAttribute('aria-label', 'Cell phone number');
    expect(getPhoneNumberInput('home')).toHaveAttribute('aria-label', 'Home phone number');
  });

  test('populates number and extension inputs from matching phones in props', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222' },
      { type: 'cell', number: '555-333-4444', extension: '99' },
    ];
    setup(phones);
    expect(getPhoneNumberInput('direct')).toHaveValue('555-111-2222');
    expect(getPhoneExtensionInput('direct')).toHaveValue('');
    expect(getPhoneNumberInput('cell')).toHaveValue('555-333-4444');
    expect(getPhoneExtensionInput('cell')).toHaveValue('99');
    expect(getPhoneNumberInput('home')).toHaveValue('');
    expect(getPhoneExtensionInput('home')).toHaveValue('');
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
    const input = getPhoneNumberInput('direct');
    await user.type(input, '5');
    expect(onChange).toHaveBeenCalled();
    const lastCall: TypedPhoneNumber[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(3);
    const direct = lastCall.find((p) => p.type === 'direct');
    expect(direct?.number).toMatch(/5/);
  });

  test('edit number for one type preserves the number and extension already set on other rows', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'cell', number: '555-333-4444', extension: '99' },
      { type: 'home', number: '555-777-8888' },
    ];
    const { user } = setup(phones, onChange);
    const input = getPhoneNumberInput('direct');
    await user.type(input, '5');

    const lastCall: TypedPhoneNumber[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const cell = lastCall.find((p) => p.type === 'cell');
    const home = lastCall.find((p) => p.type === 'home');
    expect(cell).toMatchObject({ number: '555-333-4444', extension: '99' });
    expect(home).toMatchObject({ number: '555-777-8888' });
  });

  test('edit extension — calls onChange with updated extension for the correct type', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'cell', number: '555-123-4567' }];
    const { user } = setup(phones, onChange);
    const ext = getPhoneExtensionInput('cell');
    await user.type(ext, '42');
    expect(onChange).toHaveBeenCalled();
    const lastCall: TypedPhoneNumber[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const cell = lastCall.find((p) => p.type === 'cell');
    expect(cell?.extension).toMatch(/42/);
  });

  test('edit extension for one type preserves the number and extension already set on other rows', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222', extension: '11' },
      { type: 'home', number: '555-777-8888' },
    ];
    const { user } = setup(phones, onChange);
    const ext = getPhoneExtensionInput('cell');
    await user.type(ext, '42');

    const lastCall: TypedPhoneNumber[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const direct = lastCall.find((p) => p.type === 'direct');
    const home = lastCall.find((p) => p.type === 'home');
    expect(direct).toMatchObject({ number: '555-111-2222', extension: '11' });
    expect(home).toMatchObject({ number: '555-777-8888' });
  });

  test('per-row number error renders below the correct input', () => {
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

  test('per-row extension error renders below the correct input', () => {
    const phones: TypedPhoneNumber[] = [{ type: 'cell', number: '555-123-4567', extension: 'bad' }];
    render(
      <TypedPhoneList
        phones={phones}
        onChange={vi.fn()}
        errors={{ 1: { extension: ['Invalid extension'] } }}
      />,
    );
    expect(screen.getByText('Invalid extension')).toBeInTheDocument();
  });
});
