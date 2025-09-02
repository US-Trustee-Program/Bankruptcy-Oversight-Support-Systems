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
    const id = 'phone-number-input';
    const outputId = 'phone-number-output';
    const phoneNumber = '123-456-7890';
    const blank = '';

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const Wrapper = () => {
      const ref = React.createRef<InputRef>();

      return (
        <>
          <div id={outputId} data-testid={outputId}></div>
          <PhoneNumberInput
            onChange={vi.fn()}
            id={'phone-number-input'}
            data-testid={id}
            ref={ref}
          ></PhoneNumberInput>
          <button onClick={() => ref.current?.setValue(phoneNumber)}>Set Value</button>
          <button onClick={() => ref.current?.clearValue()}>Clear Value</button>
          <button onClick={() => ref.current?.resetValue()}>Reset Value</button>
          <button
            onClick={() => {
              window.alert(ref.current!.getValue());
            }}
          >
            Get Value
          </button>
        </>
      );
    };

    render(<Wrapper />);

    await user.click(screen.getByText('Set Value'));
    await waitFor(() => {
      expect(screen.getByTestId(id)).toHaveValue(phoneNumber);
    });

    await user.click(screen.getByText('Clear Value'));
    await waitFor(() => {
      expect(screen.getByTestId(id)).toHaveValue(blank);
    });

    await user.click(screen.getByText('Set Value'));
    await waitFor(() => {
      expect(screen.getByTestId(id)).toHaveValue(phoneNumber);
    });

    await user.click(screen.getByText('Clear Value'));
    await waitFor(() => {
      expect(screen.getByTestId(id)).toHaveValue(blank);
    });

    await user.click(screen.getByText('Set Value'));
    await waitFor(() => {
      expect(screen.getByTestId(id)).toHaveValue(phoneNumber);
    });

    await user.click(screen.getByText('Get Value'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(phoneNumber);
    });
  });
});
