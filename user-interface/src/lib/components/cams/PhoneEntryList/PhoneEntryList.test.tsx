import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhoneEntryList, { PhoneRowErrors } from './PhoneEntryList';
import { PHONE_TYPES, PHONE_TYPE_LABELS, TypedPhoneNumber } from '@common/cams/trustees';

function getTypeSelect(index: number): HTMLSelectElement {
  return document.querySelector(`[data-testid$="-phone-${index}-type"]`) as HTMLSelectElement;
}

function getNumberInput(index: number): HTMLInputElement {
  return document.querySelector(`[data-testid$="-phone-${index}-number"]`) as HTMLInputElement;
}

function getExtensionInput(index: number): HTMLInputElement {
  return document.querySelector(`[data-testid$="-phone-${index}-extension"]`) as HTMLInputElement;
}

function getAddButton() {
  return screen.getByRole('button', { name: /add another phone/i });
}

function getRemoveButton(index: number) {
  return screen.getByRole('button', { name: `Remove phone entry ${index + 1}` });
}

function setup(
  phones: TypedPhoneNumber[] = [],
  options: {
    onChange?: (phones: TypedPhoneNumber[]) => void;
    errors?: Record<number, PhoneRowErrors>;
  } = {},
) {
  const user = userEvent.setup();
  const onChange = options.onChange ?? vi.fn();
  render(<PhoneEntryList phones={phones} onChange={onChange} errors={options.errors} />);
  return { user, onChange };
}

describe('PhoneEntryList', () => {
  test('renders one row per phone, populated with number and extension', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222' },
      { type: 'home', number: '555-333-4444', extension: '99' },
    ];
    setup(phones);

    expect(getTypeSelect(0)).toHaveValue('direct');
    expect(getNumberInput(0)).toHaveValue('555-111-2222');
    expect(getExtensionInput(0)).toHaveValue('');

    expect(getTypeSelect(1)).toHaveValue('home');
    expect(getNumberInput(1)).toHaveValue('555-333-4444');
    expect(getExtensionInput(1)).toHaveValue('99');
  });

  test('offers every phone type as a select option, in canonical order', () => {
    setup([{ type: 'direct', number: '' }]);

    const options = Array.from(getTypeSelect(0).options).map((o) => o.value);
    expect(options).toEqual([...PHONE_TYPES]);

    const labels = Array.from(getTypeSelect(0).options).map((o) => o.textContent);
    expect(labels).toEqual(PHONE_TYPES.map((type) => PHONE_TYPE_LABELS[type]));
  });

  test('changing the type calls onChange with the updated type for that row only', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222' },
      { type: 'home', number: '555-333-4444' },
    ];
    const { user } = setup(phones, { onChange });

    await user.selectOptions(getTypeSelect(0), 'fax');

    expect(onChange).toHaveBeenCalledWith([
      { type: 'fax', number: '555-111-2222' },
      { type: 'home', number: '555-333-4444' },
    ]);
  });

  test('editing the number calls onChange with the updated number for that row only', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '' }];
    const { user } = setup(phones, { onChange });

    await user.type(getNumberInput(0), '5551112222');

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    expect(lastCall[0].number).toMatch(/5/);
  });

  test('editing the extension calls onChange with the updated extension for that row only', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '555-111-2222' }];
    const { user } = setup(phones, { onChange });

    await user.type(getExtensionInput(0), '42');

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    expect(lastCall[0].extension).toMatch(/42/);
  });

  test('clearing the extension results in undefined rather than an empty string', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222', extension: '42' },
    ];
    const { user } = setup(phones, { onChange });

    await user.clear(getExtensionInput(0));

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    expect(lastCall[0].extension).toBeUndefined();
  });

  test('does not show a remove button when there is only one row', () => {
    setup([{ type: 'direct', number: '555-111-2222' }]);

    expect(screen.queryByRole('button', { name: /remove phone entry/i })).not.toBeInTheDocument();
  });

  test('shows a remove button for each row when there is more than one', () => {
    setup([
      { type: 'direct', number: '555-111-2222' },
      { type: 'home', number: '555-333-4444' },
    ]);

    expect(getRemoveButton(0)).toBeInTheDocument();
    expect(getRemoveButton(1)).toBeInTheDocument();
  });

  test('clicking remove calls onChange with that row removed', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222' },
      { type: 'home', number: '555-333-4444' },
    ];
    const { user } = setup(phones, { onChange });

    await user.click(getRemoveButton(0));

    expect(onChange).toHaveBeenCalledWith([{ type: 'home', number: '555-333-4444' }]);
  });

  test('clicking add another phone appends a new blank direct-type row', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '555-111-2222' }];
    const { user } = setup(phones, { onChange });

    await user.click(getAddButton());

    expect(onChange).toHaveBeenCalledWith([
      { type: 'direct', number: '555-111-2222' },
      { type: 'direct', number: '' },
    ]);
  });

  test('shows the add button below the maximum of 20 phones', () => {
    const phones: TypedPhoneNumber[] = Array.from({ length: 19 }, (_, i) => ({
      type: 'direct' as const,
      number: `555-000-${String(i).padStart(4, '0')}`,
    }));
    setup(phones);

    expect(getAddButton()).toBeInTheDocument();
  });

  test('hides the add button once the maximum of 20 phones is reached', () => {
    const phones: TypedPhoneNumber[] = Array.from({ length: 20 }, (_, i) => ({
      type: 'direct' as const,
      number: `555-000-${String(i).padStart(4, '0')}`,
    }));
    setup(phones);

    expect(screen.queryByRole('button', { name: /add another phone/i })).not.toBeInTheDocument();
  });

  test('renders per-row type, number, and extension errors', () => {
    setup([{ type: 'direct', number: 'bad' }], {
      errors: {
        0: { type: ['Type error'], number: ['Number error'], extension: ['Extension error'] },
      },
    });

    expect(screen.getByText('Type error')).toBeInTheDocument();
    expect(screen.getByText('Number error')).toBeInTheDocument();
    expect(screen.getByText('Extension error')).toBeInTheDocument();
  });
});
