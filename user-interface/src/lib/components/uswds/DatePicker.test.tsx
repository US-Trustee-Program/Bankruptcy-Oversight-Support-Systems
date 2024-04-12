import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DatePicker, { DatePickerProps } from './DatePicker';
import { InputRef } from '@/lib/type-declarations/input-fields';

describe('Test DatePicker component', async () => {
  const DEFAULT_ID = 'test-datepicker';
  const onChangeSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProps(props?: Partial<DatePickerProps>): InputRef {
    const ref = React.createRef<InputRef>();
    const defaultProps: DatePickerProps = {
      id: DEFAULT_ID,
      onChange: onChangeSpy,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <React.StrictMode>
        <BrowserRouter>
          <DatePicker {...renderProps} ref={ref} />
        </BrowserRouter>
      </React.StrictMode>,
    );
    return ref.current!;
  }

  test('should clear when clearValue() is called', () => {
    const initialValue = '2024-01-01';

    const ref = renderWithProps({ value: initialValue });

    const datePicker = screen.getByTestId(DEFAULT_ID);
    const step1 = datePicker.attributes.getNamedItem('value')?.value;
    expect(step1).toEqual(initialValue);

    ref.clearValue();
    waitFor(() => {
      const step2 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step2).toEqual('');
    });
  });

  test('should set the value when setValue() is called', () => {
    const initialValue = '2024-01-01';
    const updatedValue = '2024-01-02';

    const ref = renderWithProps({ value: initialValue });

    const datePicker = screen.getByTestId(DEFAULT_ID);
    const step1 = datePicker.attributes.getNamedItem('value')?.value;
    expect(step1).toEqual(initialValue);

    ref.setValue(updatedValue);
    waitFor(() => {
      const step2 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step2).toEqual(updatedValue);
    });
  });

  test('should reset when resetValue() is called', () => {
    const initialValue = '2024-01-01';
    const updatedValue = '2024-01-02';
    const ref = renderWithProps({ value: initialValue });

    const datePicker = screen.getByTestId(DEFAULT_ID);
    const step1 = datePicker.attributes.getNamedItem('value')?.value;
    expect(step1).toEqual(initialValue);

    ref.setValue(updatedValue);
    waitFor(() => {
      const step2 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step2).toEqual(updatedValue);
    });

    ref.resetValue();
    waitFor(() => {
      const step3 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step3).toEqual(initialValue);
    });
  });

  test('should be disabled when disable() is called', async () => {
    const ref = renderWithProps();

    const datePicker = screen.getByTestId(DEFAULT_ID);
    expect(datePicker).toBeEnabled();

    ref.disable(true);
    await waitFor(() => {
      expect(datePicker).not.toBeEnabled();
    });

    ref.disable(false);
    await waitFor(() => {
      expect(datePicker).toBeEnabled();
    });
  });
});
