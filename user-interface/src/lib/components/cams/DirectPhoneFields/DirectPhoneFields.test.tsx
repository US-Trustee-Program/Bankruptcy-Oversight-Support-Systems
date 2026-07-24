import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DirectPhoneFields, { DirectPhoneErrors } from './DirectPhoneFields';
import { TypedPhoneNumber } from '@common/cams/trustees';

function getPhoneInput(): HTMLInputElement {
  return document.querySelector('[data-testid$="-legacy-phone"]') as HTMLInputElement;
}

function getExtensionInput(): HTMLInputElement {
  return document.querySelector('[data-testid$="-legacy-extension"]') as HTMLInputElement;
}

function setup(
  phones: TypedPhoneNumber[] = [],
  options: {
    onChange?: (phones: TypedPhoneNumber[]) => void;
    errors?: DirectPhoneErrors;
  } = {},
) {
  const user = userEvent.setup();
  const onChange = options.onChange ?? vi.fn();
  render(<DirectPhoneFields phones={phones} onChange={onChange} errors={options.errors} />);
  return { user, onChange };
}

describe('DirectPhoneFields', () => {
  test('renders bound to the direct-type phone, ignoring other types', () => {
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '555-111-2222', extension: '99' },
      { type: 'home', number: '555-333-4444' },
    ];
    setup(phones);

    expect(getPhoneInput()).toHaveValue('555-111-2222');
    expect(getExtensionInput()).toHaveValue('99');
  });

  test('renders empty inputs when no direct-type phone exists', () => {
    setup([{ type: 'home', number: '555-333-4444' }]);

    expect(getPhoneInput()).toHaveValue('');
    expect(getExtensionInput()).toHaveValue('');
  });

  test('editing the phone number updates only the direct-type entry', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [
      { type: 'direct', number: '' },
      { type: 'home', number: '555-333-4444' },
    ];
    const { user } = setup(phones, { onChange });

    await user.type(getPhoneInput(), '5551112222');

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    const direct = lastCall.find((p) => p.type === 'direct');
    const home = lastCall.find((p) => p.type === 'home');
    expect(direct?.number).toMatch(/5/);
    expect(home).toEqual({ type: 'home', number: '555-333-4444' });
  });

  test('editing the extension updates only the direct-type entry', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'direct', number: '555-111-2222' }];
    const { user } = setup(phones, { onChange });

    await user.type(getExtensionInput(), '42');

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    expect(lastCall[0].extension).toMatch(/42/);
  });

  test('creates a direct-type entry when editing the phone number and none exists yet', async () => {
    const onChange = vi.fn();
    const phones: TypedPhoneNumber[] = [{ type: 'home', number: '555-333-4444' }];
    const { user } = setup(phones, { onChange });

    await user.type(getPhoneInput(), '5551112222');

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    const direct = lastCall.find((p) => p.type === 'direct');
    const home = lastCall.find((p) => p.type === 'home');
    expect(direct?.number).toMatch(/5/);
    expect(home).toEqual({ type: 'home', number: '555-333-4444' });
  });

  test('creates a direct-type entry when editing the extension and none exists yet', async () => {
    const onChange = vi.fn();
    const { user } = setup([], { onChange });

    await user.type(getExtensionInput(), '42');

    const lastCall = onChange.mock.calls.at(-1)![0] as TypedPhoneNumber[];
    const direct = lastCall.find((p) => p.type === 'direct');
    expect(direct?.extension).toMatch(/42/);
    expect(direct?.number).toBe('');
  });

  test('renders phone and extension errors', () => {
    setup([{ type: 'direct', number: 'bad' }], {
      errors: { phone: ['Invalid phone'], extension: ['Invalid extension'] },
    });

    expect(document.body).toHaveTextContent('Invalid phone');
    expect(document.body).toHaveTextContent('Invalid extension');
  });
});
