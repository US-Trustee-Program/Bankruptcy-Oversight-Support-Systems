import { render, screen, waitFor } from '@testing-library/react';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import userEvent from '@testing-library/user-event';
import { InputRef } from '@/lib/type-declarations/input-fields';
import React from 'react';

describe('PhoneNumberInput', () => {
  const user = userEvent.setup();
  test('should only accept numbers', async () => {
    render(<PhoneNumberInput onChange={vi.fn()} id={'phone-number-input'}></PhoneNumberInput>);

    const input = screen.getByTestId('phone-number-input');

    await user.type(input, 'abc');
    expect(input).toHaveValue('');

    await user.type(input, '123abc');
    expect(input).toHaveValue('123');

    await user.clear(input);
    await user.type(input, '1234567890');
    expect(input).toHaveValue('123-456-7890');

    await user.clear(input);
    await user.type(input, '123456sdgg7890123456789012345()678---901234567890');
    expect(input).toHaveValue('123-456-7890');
  });

  test('should properly handle value imperatives', async () => {
    const ref = React.createRef<InputRef>();
    render(
      <PhoneNumberInput onChange={vi.fn()} id={'phone-number-input'} ref={ref}></PhoneNumberInput>,
    );

    ref.current?.setValue('123-456-7890');
    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('123-456-7890');
    });
    ref.current?.clearValue();
    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('');
    });
    ref.current?.setValue('123-456-7890');
    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('123-456-7890');
    });
    ref.current?.resetValue();
    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('');
    });
  });

  test('should properly handle reset with value in props', async () => {
    const ref = React.createRef<InputRef>();
    render(
      <PhoneNumberInput
        onChange={vi.fn()}
        id={'phone-number-input'}
        ref={ref}
        value={'123-456-7890'}
      ></PhoneNumberInput>,
    );

    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('123-456-7890');
    });
    ref.current?.clearValue();
    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('');
    });
    ref.current?.resetValue();
    await waitFor(() => {
      expect(ref.current?.getValue()).toBe('123-456-7890');
    });
  });
});
