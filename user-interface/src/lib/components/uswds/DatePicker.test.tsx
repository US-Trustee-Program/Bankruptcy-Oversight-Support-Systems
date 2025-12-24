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

    const label = document.getElementById(`${DEFAULT_ID}-label`);
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

  test('should set aria-invalid when there is an error', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Initially should not have aria-invalid
    expect(inputEl).not.toHaveAttribute('aria-invalid');

    // Enter date before minDate
    fireEvent.change(inputEl, { target: { value: '2023-12-31' } });

    // Wait for error to appear
    await waitFor(() => {
      expect(inputEl).toHaveAttribute('aria-invalid', 'true');
    });

    // Error div should be referenced in aria-describedby
    expect(inputEl.getAttribute('aria-describedby')).toContain(`${DEFAULT_ID}-error`);
  });

  test('should include error ID in aria-describedby when custom error is provided', () => {
    const customError = 'Custom error message';
    renderWithProps({ customErrorMessage: customError });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Should have aria-invalid when error exists
    expect(inputEl).toHaveAttribute('aria-invalid', 'true');

    // aria-describedby should include error ID
    expect(inputEl.getAttribute('aria-describedby')).toContain(`${DEFAULT_ID}-error`);

    // Error should be displayed
    const errorDiv = document.getElementById(`${DEFAULT_ID}-error`);
    expect(errorDiv).toHaveTextContent(customError);
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

describe('DatePicker edge case coverage', () => {
  const DEFAULT_ID = 'test-datepicker-edge';
  const mockOnChange = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
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

  test('should not show error for incomplete date (year-month only)', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter incomplete date (only year-month)
    fireEvent.change(inputEl, { target: { value: '2024-06' } });

    // Wait a bit to ensure validation doesn't trigger
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Error should not be shown for incomplete dates
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should not show error for invalid date like Feb 31', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter invalid date (Feb 31 doesn't exist)
    fireEvent.change(inputEl, { target: { value: '2024-02-31' } });

    // Wait for potential validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Error should not be shown for invalid dates (they're ignored)
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should allow dates with years before 1900 when within minDate/maxDate range', async () => {
    const minDate = '1800-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date with year before 1900 but within allowed range
    fireEvent.change(inputEl, { target: { value: '1850-06-15' } });

    // Wait for potential validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // No error should be shown - the arbitrary 1900-2200 restriction has been removed
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should show warning when futureDateWarningThresholdYears is configured', async () => {
    const minDate = '2024-01-01';
    const maxDate = '9999-12-31';
    renderWithProps({
      minDate,
      maxDate,
      onChange: mockOnChange,
      futureDateWarningThresholdYears: 100,
    });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date more than 100 years in the future (e.g., year 2250)
    fireEvent.change(inputEl, { target: { value: '2250-06-15' } });

    // Wait for validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Warning should be shown (not an error)
    const warningElement = document.querySelector('.date-warning');
    expect(warningElement).toBeInTheDocument();
    expect(warningElement?.textContent).toContain('more than 100 years in the future');

    // No error should be shown
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should not show warning when futureDateWarningThresholdYears is not configured', async () => {
    const minDate = '2024-01-01';
    const maxDate = '9999-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date more than 100 years in the future
    fireEvent.change(inputEl, { target: { value: '2250-06-15' } });

    // Wait for validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // No warning should be shown since prop is not configured
    const warningElement = document.querySelector('.date-warning');
    expect(warningElement).not.toBeInTheDocument();

    // No error should be shown either (date is within min/max range)
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should clear error when entering valid date after error', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First, enter invalid date (before minDate) to trigger error
    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    // Wait for error to appear
    await waitFor(() => {
      const errorElement = document.querySelector('.date-error');
      expect(errorElement?.textContent).toContain('Date is not within allowed range');
    });

    // Now enter valid date within range
    fireEvent.change(inputEl, { target: { value: '2024-06-15' } });

    // Wait for validation to clear error
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Error should be cleared
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should handle onBlur callback', () => {
    const onBlurSpy = vi.fn();
    renderWithProps({ onBlur: onBlurSpy });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Trigger blur event
    fireEvent.blur(inputEl);

    expect(onBlurSpy).toHaveBeenCalledTimes(1);
  });

  test('should clear error when entering incomplete date after error exists', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First, enter invalid date (before minDate) to trigger error
    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    // Wait for error to appear
    await waitFor(() => {
      const errorElement = document.querySelector('.date-error');
      expect(errorElement?.textContent).toContain('Date is not within allowed range');
    });

    // Now enter incomplete date (only year-month)
    fireEvent.change(inputEl, { target: { value: '2024-06' } });

    // Error should be cleared immediately for incomplete dates (no debounce)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should clear error when entering invalid date after error exists', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First, enter out-of-range date to trigger error
    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    // Wait for error to appear
    await waitFor(() => {
      const errorElement = document.querySelector('.date-error');
      expect(errorElement?.textContent).toContain('Date is not within allowed range');
    });

    // Now enter invalid date like Feb 31 (invalid but complete format)
    fireEvent.change(inputEl, { target: { value: '2024-02-31' } });

    // Error should be cleared immediately for invalid dates (no debounce)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should not show error for truly invalid dates like month 13', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date with invalid month (month 13 doesn't exist)
    fireEvent.change(inputEl, { target: { value: '2024-13-01' } });

    // Wait for potential validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Error should not be shown for truly invalid dates (they're ignored)
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should not show error for invalid day like day 32', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date with invalid day (day 32 doesn't exist)
    fireEvent.change(inputEl, { target: { value: '2024-12-32' } });

    // Wait for potential validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Error should not be shown for truly invalid dates (they're ignored)
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should clear error when entering truly invalid date after error exists', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First, enter out-of-range date to trigger error
    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    // Wait for error to appear
    await waitFor(() => {
      const errorElement = document.querySelector('.date-error');
      expect(errorElement?.textContent).toContain('Date is not within allowed range');
    });

    // Now enter truly invalid date (month 13)
    fireEvent.change(inputEl, { target: { value: '2024-13-01' } });

    // Error should be cleared immediately for invalid dates (no debounce)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should have default max attribute to prevent year overflow', () => {
    renderWithProps({ onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID) as HTMLInputElement;

    // Should have default max attribute when none provided
    expect(inputEl).toHaveAttribute('max', '9999-12-31');
  });

  test('should respect custom maxDate over default max', () => {
    const customMax = '2025-12-31';
    renderWithProps({ maxDate: customMax, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID) as HTMLInputElement;

    // Should use custom maxDate when provided
    expect(inputEl).toHaveAttribute('max', customMax);
  });

  test('should not show warning for dates exactly at threshold', async () => {
    renderWithProps({ onChange: mockOnChange, futureDateWarningThresholdYears: 100 });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Calculate exactly 100 years from now
    const now = new Date();
    const hundredYearsFromNow = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());
    const dateString = hundredYearsFromNow.toISOString().split('T')[0];

    fireEvent.change(inputEl, { target: { value: dateString } });

    // Wait for validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // No warning should be shown for exactly at the threshold
    const warningElement = document.querySelector('.date-warning');
    expect(warningElement).not.toBeInTheDocument();
  });

  test('should not show warning when there is an error', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({
      minDate,
      maxDate,
      onChange: mockOnChange,
      futureDateWarningThresholdYears: 100,
    });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date that violates maxDate constraint (more than 100 years in future too)
    fireEvent.change(inputEl, { target: { value: '2250-06-15' } });

    // Wait for validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Error should be shown (because it exceeds maxDate)
    const errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toContain('Date is not within allowed range');

    // Warning should NOT be shown when there's an error
    const warningElement = document.querySelector('.date-warning');
    expect(warningElement).not.toBeInTheDocument();
  });

  test('should clear warning when date is changed to within threshold', async () => {
    renderWithProps({ onChange: mockOnChange, futureDateWarningThresholdYears: 100 });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // First enter a date more than 100 years in the future
    fireEvent.change(inputEl, { target: { value: '2250-06-15' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Warning should be shown
    let warningElement = document.querySelector('.date-warning');
    expect(warningElement).toBeInTheDocument();

    // Now change to a date within 100 years
    fireEvent.change(inputEl, { target: { value: '2025-06-15' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Warning should be cleared
    warningElement = document.querySelector('.date-warning');
    expect(warningElement).not.toBeInTheDocument();
  });

  test('should respect custom futureDateWarningThresholdYears values', async () => {
    // Test with 50 years threshold
    renderWithProps({ onChange: mockOnChange, futureDateWarningThresholdYears: 50 });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    // Enter date 51 years in the future
    const now = new Date();
    const fiftyOnerearsFromNow = new Date(now.getFullYear() + 51, now.getMonth(), now.getDate());
    const dateString = fiftyOnerearsFromNow.toISOString().split('T')[0];

    fireEvent.change(inputEl, { target: { value: dateString } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Warning should be shown with custom threshold
    const warningElement = document.querySelector('.date-warning');
    expect(warningElement).toBeInTheDocument();
    expect(warningElement?.textContent).toContain('more than 50 years in the future');
  });
});
