import { render, screen, waitFor } from '@testing-library/react';
import ZipCodeInput, { formatZipCodeInput } from '@/lib/components/ZipCodeInput';
import { InputRef } from '@/lib/type-declarations/input-fields';
import React from 'react';
import TestingUtilities from '@/lib/testing/testing-utilities';

describe('ZipCodeInput', () => {
  const userEvent = TestingUtilities.setupUserEvent();

  test('formatZipCodeInput formats zip codes correctly', () => {
    expect(formatZipCodeInput('')).toEqual({ formattedZipCode: '' });
    expect(formatZipCodeInput('12345')).toEqual({ formattedZipCode: '12345' });
    expect(formatZipCodeInput('123456')).toEqual({ formattedZipCode: '12345-6' });
    expect(formatZipCodeInput('1234567')).toEqual({ formattedZipCode: '12345-67' });
    expect(formatZipCodeInput('123456789')).toEqual({ formattedZipCode: '12345-6789' });
    expect(formatZipCodeInput('12a34-56')).toEqual({ formattedZipCode: '12345-6' });
    expect(formatZipCodeInput('1234567890123')).toEqual({ formattedZipCode: '12345-6789' });
    expect(formatZipCodeInput('abc')).toEqual({ formattedZipCode: '' });
  });

  test('should format user input as they type and support imperative handlers', async () => {
    const id = 'zip-input';
    const zipFull = '12345-6789';

    const Wrapper = () => {
      const ref = React.createRef<InputRef>();

      return (
        <>
          <ZipCodeInput id={id} data-testid={id} onChange={vi.fn()} ref={ref} />
          <button onClick={() => ref.current?.setValue('123456789')}>Set Value</button>
          <button onClick={() => ref.current?.clearValue()}>Clear Value</button>
          <button onClick={() => {}}>Noop</button>
        </>
      );
    };

    render(<Wrapper />);

    const input = screen.getByTestId(id) as HTMLInputElement;

    await userEvent.type(input, '123456789');
    await waitFor(() => expect(input).toHaveValue(zipFull));

    await userEvent.click(screen.getByText('Clear Value'));
    await waitFor(() => expect(input).toHaveValue(''));

    await userEvent.click(screen.getByText('Set Value'));
    await waitFor(() => expect(input).toHaveValue(zipFull));
  });

  test('should support resetValue, getValue, disable, and focus imperatives', async () => {
    const id = 'zip-imperative-test';
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const Wrapper = () => {
      const ref = React.createRef<InputRef>();
      return (
        <>
          <ZipCodeInput id={id} data-testid={id} onChange={vi.fn()} ref={ref} />
          <button onClick={() => ref.current?.setValue('123456789')}>Set Value</button>
          <button onClick={() => ref.current?.resetValue()}>Reset Value</button>
          <button onClick={() => window.alert(ref.current?.getValue())}>Get Value</button>
          <button onClick={() => ref.current?.disable(true)}>Disable</button>
          <button onClick={() => ref.current?.disable(false)}>Enable</button>
          <button onClick={() => ref.current?.focus()}>Focus</button>
        </>
      );
    };

    render(<Wrapper />);
    const input = screen.getByTestId(id) as HTMLInputElement;

    await userEvent.click(screen.getByText('Set Value'));
    await waitFor(() => expect(input).toHaveValue('12345-6789'));

    await userEvent.click(screen.getByText('Get Value'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('12345-6789'));

    await userEvent.click(screen.getByText('Reset Value'));
    await waitFor(() => expect(input).toHaveValue(''));

    await userEvent.click(screen.getByText('Disable'));
    await waitFor(() => expect(input).toBeDisabled());

    await userEvent.click(screen.getByText('Enable'));
    await waitFor(() => expect(input).not.toBeDisabled());

    await userEvent.click(screen.getByText('Focus'));
    await waitFor(() => expect(input).toHaveFocus());
  });
});
