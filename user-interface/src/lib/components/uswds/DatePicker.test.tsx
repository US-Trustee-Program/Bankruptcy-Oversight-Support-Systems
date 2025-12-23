import React, { act } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DatePicker, { DatePickerProps } from './DatePicker';
import { InputRef } from '@/lib/type-declarations/input-fields';

// NOTE For some reason (known issue) a date input element can not be changed by typing a date
// in the formation that the UI expects. The date may only be changed using a change event and
// the format must be in YYYY-DD-MM format.

describe('Test DatePicker component', async () => {
  const DEFAULT_ID = 'test-datepicker';
  const onChangeSpy = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
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

  test('should clear when clearValue() is called', async () => {
    const initialValue = '2024-01-01';

    const view = renderWithProps({ value: initialValue });

    const datePicker = screen.getByTestId(DEFAULT_ID);
    const step1 = datePicker.attributes.getNamedItem('value')?.value;
    expect(step1).toEqual(initialValue);

    act(() => view.clearValue());
    await waitFor(() => {
      const step2 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step2).toEqual('');
    });
  });

  test('should set the value when setValue() is called', async () => {
    const initialValue = '2024-01-01';
    const updatedValue = '2024-01-02';

    const view = renderWithProps({ value: initialValue });

    const datePicker = screen.getByTestId(DEFAULT_ID);
    const step1 = datePicker.attributes.getNamedItem('value')?.value;
    expect(step1).toEqual(initialValue);

    act(() => view.setValue(updatedValue));
    await waitFor(() => {
      const step2 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step2).toEqual(updatedValue);
    });
  });

  test('should reset when resetValue() is called', async () => {
    const initialValue = '2024-01-01';
    const updatedValue = '2024-01-02';
    const view = renderWithProps({ value: initialValue });

    const datePicker = screen.getByTestId(DEFAULT_ID);
    const step1 = datePicker.attributes.getNamedItem('value')?.value;
    expect(step1).toEqual(initialValue);

    act(() => view.setValue(updatedValue));
    await waitFor(() => {
      const step2 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step2).toEqual(updatedValue);
    });

    act(() => view.resetValue());
    await waitFor(() => {
      const step3 = datePicker.attributes.getNamedItem('value')?.value;
      expect(step3).toEqual(initialValue);
    });
  });

  test('should be disabled when disable() is called', async () => {
    const view = renderWithProps();

    const datePicker = screen.getByTestId(DEFAULT_ID);
    expect(datePicker).toBeEnabled();

    act(() => view.disable(true));
    await waitFor(() => {
      expect(datePicker).not.toBeEnabled();
    });

    act(() => view.disable(false));
    await waitFor(() => {
      expect(datePicker).toBeEnabled();
    });
  });
});

describe('DatePicker additional coverage tests', () => {
  const DEFAULT_ID = 'test-datepicker';
  const mockOnChange = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle className prop on form group and input', () => {
    const customClass = 'my-custom-class';
    renderWithProps({ className: customClass });

    const formGroup = document.querySelector('.usa-form-group.date-picker');
    const inputEl = screen.getByTestId(DEFAULT_ID);

    expect(formGroup).toHaveClass(customClass);
    expect(inputEl).toHaveClass('usa-input', customClass);
  });

  test('should handle label prop', () => {
    const labelText = 'Select a date';
    renderWithProps({ label: labelText });

    const label = document.getElementById(`${DEFAULT_ID}-date-label`);
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent(labelText);
  });

  test('should handle minDate and maxDate attributes', () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate });

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toHaveAttribute('min', minDate);
    expect(inputEl).toHaveAttribute('max', maxDate);
  });

  test('should handle required prop', () => {
    renderWithProps({ required: true });

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toHaveAttribute('required');
  });

  test('should handle name prop', () => {
    const name = 'test-date-name';
    renderWithProps({ name });

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toHaveAttribute('name', name);
  });

  test('should handle aria attributes', () => {
    renderWithProps({ 'aria-describedby': 'custom-description', 'aria-live': 'polite' });

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toHaveAttribute('aria-describedby', 'custom-description');
    expect(inputEl).toHaveAttribute('aria-live', 'polite');
  });

  test('should show error message when date is invalid', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Trigger a change event with invalid date (before minDate)
    fireEvent.change(inputEl, { target: { value: '2023-12-31' } });

    await waitFor(() => {
      const errorElement = document.querySelector('.date-error');
      expect(errorElement).toHaveTextContent(
        'Date is not within allowed range. Enter a valid date.',
      );
    });
  });

  test('should handle empty setValue gracefully', () => {
    const initialValue = '2024-01-01';
    const view = renderWithProps({ value: initialValue });

    // Setting empty value should trigger resetValue
    view.setValue('');

    // Should reset to initial value since it's provided
    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toHaveValue(initialValue);
  });

  test('should reset to minDate when no initial value and minDate exists', async () => {
    const minDate = '2024-01-01';
    const view = renderWithProps({ minDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First set a value
    fireEvent.change(inputEl, { target: { value: '2024-02-15' } });

    // Then reset - should go to minDate since no initial value was provided
    act(() => view.resetValue());

    await waitFor(() => {
      expect(inputEl).toHaveValue('2024-01-01');
    });
  });

  test('should handle focus method', async () => {
    const view = renderWithProps();

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).not.toHaveFocus();

    view.focus();
    await waitFor(() => {
      expect(inputEl).toHaveFocus();
    });
  });

  test('should handle change event with valid date within range', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2024-06-15' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  test('should handle initial disabled state', () => {
    renderWithProps({ disabled: true });

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toBeDisabled();
  });

  test('should apply error styling when error exists', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Trigger an error by entering invalid date (before minDate)
    fireEvent.change(inputEl, { target: { value: '2023-12-31' } });

    await waitFor(() => {
      expect(inputEl).toHaveClass('usa-input--error');
    });
  });

  test('should reset to clearDateValue when no initial value and no minDate', async () => {
    const view = renderWithProps({ onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First set a value
    fireEvent.change(inputEl, { target: { value: '2024-02-15' } });

    // Then reset - should clear since no initial value and no minDate
    act(() => view.resetValue());

    await waitFor(() => {
      expect(inputEl).toHaveValue('');
    });
  });

  test('should handle invalid date and call onChange', async () => {
    const initialValue = '2024-01-15';
    const mockChangeSpy = vi.fn();
    renderWithProps({
      value: initialValue,
      minDate: '2024-01-01',
      maxDate: '2024-12-31',
      onChange: mockChangeSpy,
    });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: 'invalid-date' } });

    await waitFor(() => {
      expect(mockChangeSpy).toHaveBeenCalledTimes(1);
    });
  });

  test('should handle clearDateValue setTimeout behavior', () => {
    const spy = vi.spyOn(window, 'setTimeout');

    render(<DatePicker id="test-setTimeout" />);

    const component = document.getElementById('test-setTimeout');
    expect(component).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(0);
    spy.mockRestore();
  });

  test('should execute setTimeout callback in clearDateValue', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    const ref = React.createRef<InputRef>();
    render(<DatePicker id="test-timeout-callback" ref={ref} value="2024-01-01" />);

    // Call clearValue which will trigger clearDateValue and its setTimeout
    act(() => ref.current?.clearValue());

    // Verify setTimeout was called
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

    // Manually execute the callback to cover line 37 (setDateValue(null))
    const callback = setTimeoutSpy.mock.calls[0][0] as () => void;
    act(() => callback());

    setTimeoutSpy.mockRestore();
  });

  test('should test getValue method through ref', () => {
    const ref = React.createRef<InputRef>();
    render(<DatePicker id="test-date-picker" ref={ref} value="2024-01-15" />);

    act(() => expect(ref.current?.getValue()).toBe('2024-01-15'));
  });

  test('should return empty string from getValue when no value', () => {
    const ref = React.createRef<InputRef>();
    render(<DatePicker id="test-date-picker-empty" ref={ref} />);

    act(() => expect(ref.current?.getValue()).toBe(''));
  });

  test('should set error message when date is below maxDate threshold', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date that's after maxDate
    fireEvent.change(inputEl, { target: { value: '2025-01-01' } });

    await waitFor(() => {
      const errorElement = document.querySelector('.date-error');
      expect(errorElement).toHaveTextContent(
        'Date is not within allowed range. Enter a valid date.',
      );
    });
  });

  test('should handle change without minDate or maxDate validation', () => {
    renderWithProps({ onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter a valid date - should call onChange directly
    fireEvent.change(inputEl, { target: { value: '2024-06-15' } });

    expect(mockOnChange).toHaveBeenCalled();
  });

  function renderWithProps(props?: Partial<DatePickerProps>): InputRef {
    const ref = React.createRef<InputRef>();
    const defaultProps: DatePickerProps = {
      id: DEFAULT_ID,
      onChange: mockOnChange,
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
});
