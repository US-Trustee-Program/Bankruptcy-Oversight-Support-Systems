import React, { act } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DatePicker, { DatePickerProps } from './DatePicker';
import { InputRef } from '@/lib/type-declarations/input-fields';

// NOTE For some reason (known issue) a date input element can not be changed by typing a date
// in the formation that the UI expects. The date may only be changed using a change event and
// the format must be in YYYY-DD-MM format.

const DEFAULT_ID = 'test-datepicker';
const DEBOUNCE_MS = 600;
const IMMEDIATE_MS = 100;
const mockOnChange = vi.fn();

function getErrorText() {
  return (document.querySelector('.date-error') as HTMLElement | null)?.textContent ?? '';
}

function getInput(id: string) {
  return screen.getByTestId(id) as HTMLInputElement;
}

function getWarningElement() {
  return document.querySelector('.date-warning');
}

function getWarningText() {
  return (document.querySelector('.date-warning') as HTMLElement | null)?.textContent ?? '';
}

function renderWithProps(props?: Partial<DatePickerProps>): InputRef {
  const ref = React.createRef<InputRef>();
  const defaultProps: DatePickerProps = { id: DEFAULT_ID, onChange: mockOnChange };
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

async function waitForValidation(ms = DEBOUNCE_MS) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe('Test DatePicker component', async () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    view.setValue('');

    const inputEl = screen.getByTestId(DEFAULT_ID);
    expect(inputEl).toHaveValue(initialValue);
  });

  test('should reset to minDate when no initial value and minDate exists', async () => {
    const minDate = '2024-01-01';
    const view = renderWithProps({ minDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2024-02-15' } });

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

    fireEvent.change(inputEl, { target: { value: '2023-12-31' } });

    await waitFor(() => {
      expect(inputEl).toHaveClass('usa-input--error');
    });
  });

  test('should set error message when date is above maxDate threshold', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

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

    fireEvent.change(inputEl, { target: { value: '2024-06-15' } });

    expect(mockOnChange).toHaveBeenCalled();
  });

  test('should set aria-invalid when there is an error', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    expect(inputEl).not.toHaveAttribute('aria-invalid');

    fireEvent.change(inputEl, { target: { value: '2023-12-31' } });

    await waitFor(() => {
      expect(inputEl).toHaveAttribute('aria-invalid', 'true');
    });

    expect(inputEl.getAttribute('aria-describedby')).toContain(`${DEFAULT_ID}-error`);
  });

  test('should include error ID in aria-describedby when custom error is provided', () => {
    const customError = 'Custom error message';
    renderWithProps({ customErrorMessage: customError });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    expect(inputEl).toHaveAttribute('aria-invalid', 'true');
    expect(inputEl.getAttribute('aria-describedby')).toContain(`${DEFAULT_ID}-error`);

    const errorDiv = document.getElementById(`${DEFAULT_ID}-error`);
    expect(errorDiv).toHaveTextContent(customError);
  });

  test('should reset to clearDateValue when no initial value and no minDate', async () => {
    const view = renderWithProps({ onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2024-02-15' } });

    act(() => view.resetValue());

    await waitFor(() => {
      expect(inputEl).toHaveValue('');
    });
  });

  test('should handle invalid date input gracefully', async () => {
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
      expect(mockChangeSpy).toHaveBeenCalled();
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

    act(() => ref.current?.clearValue());

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

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

  test('should clear errors and warnings when field becomes empty', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    await waitForValidation();

    expect(getErrorText()).toContain('Date is not within allowed range');

    fireEvent.change(inputEl, { target: { value: '' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(getErrorText()).toBe('');
  });

  test('should clear errors and warnings when date is incomplete', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    await waitForValidation();

    expect(getErrorText()).toContain('Date is not within allowed range');

    fireEvent.change(inputEl, { target: { value: '2024-06' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(getErrorText()).toBe('');
  });

  test('should clear errors and warnings for invalid dates', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = screen.getByTestId(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    let errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toContain('Date is not within allowed range');

    fireEvent.change(inputEl, { target: { value: '2024-02-31' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toBe('');
  });

  test('should clear warning message when clearValue() is called', async () => {
    const ref = React.createRef<InputRef>();
    const today = new Date();
    const farFutureDate = new Date(today.getFullYear() + 150, today.getMonth(), today.getDate());
    const farFutureDateString = farFutureDate.toISOString().split('T')[0];

    render(
      <DatePicker
        id="test-clear-warning"
        ref={ref}
        futureDateWarningThresholdYears={100}
        onChange={mockOnChange}
      />,
    );

    const inputEl = screen.getByTestId('test-clear-warning');

    fireEvent.change(inputEl, { target: { value: farFutureDateString } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    let warningElement = document.querySelector('.date-warning');
    expect(warningElement).toBeInTheDocument();
    expect(warningElement?.textContent).toContain('more than 100 years in the future');

    act(() => ref.current?.clearValue());

    await waitFor(() => {
      warningElement = document.querySelector('.date-warning');
      expect(warningElement).toBeNull();
    });
  });

  test('should clear warning message when resetValue() is called', async () => {
    const ref = React.createRef<InputRef>();
    const today = new Date();
    const farFutureDate = new Date(today.getFullYear() + 150, today.getMonth(), today.getDate());
    const farFutureDateString = farFutureDate.toISOString().split('T')[0];

    render(
      <DatePicker
        id="test-reset-warning"
        ref={ref}
        value="2024-01-01"
        futureDateWarningThresholdYears={100}
        onChange={mockOnChange}
      />,
    );

    const inputEl = screen.getByTestId('test-reset-warning');

    fireEvent.change(inputEl, { target: { value: farFutureDateString } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    let warningElement = document.querySelector('.date-warning');
    expect(warningElement).toBeInTheDocument();
    expect(warningElement?.textContent).toContain('more than 100 years in the future');

    act(() => ref.current?.resetValue());

    await waitFor(() => {
      warningElement = document.querySelector('.date-warning');
      expect(warningElement).toBeNull();
      expect(inputEl).toHaveValue('2024-01-01');
    });
  });

  test('should clear error message when resetValue() is called', async () => {
    const ref = React.createRef<InputRef>();
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';

    render(
      <DatePicker
        id="test-reset-error"
        ref={ref}
        value="2024-06-15"
        minDate={minDate}
        maxDate={maxDate}
        onChange={mockOnChange}
      />,
    );

    const inputEl = screen.getByTestId('test-reset-error');

    fireEvent.change(inputEl, { target: { value: '2025-12-31' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    let errorElement = document.querySelector('.date-error');
    expect(errorElement?.textContent).toContain('Date is not within allowed range');

    act(() => ref.current?.resetValue());

    await waitFor(() => {
      errorElement = document.querySelector('.date-error');
      expect(errorElement?.textContent).toBe('');
      expect(inputEl).toHaveValue('2024-06-15');
    });
  });
});

describe('DatePicker edge case coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe('invalid date handling', () => {
    test.each([
      ['incomplete date (year-month only)', '2024-06'],
      ['invalid date like Feb 31', '2024-02-31'],
      ['truly invalid date like month 13', '2024-13-01'],
      ['invalid day like day 32', '2024-12-32'],
    ])('should not show error for %s', async (_label, value) => {
      const minDate = '2024-01-01';
      const maxDate = '2024-12-31';
      renderWithProps({ minDate, maxDate, onChange: mockOnChange });

      fireEvent.change(getInput(DEFAULT_ID), { target: { value } });

      await waitForValidation();
      expect(getErrorText()).toBe('');
    });

    test.each([
      ['incomplete date', '2024-06', IMMEDIATE_MS],
      ['invalid date Feb 31', '2024-02-31', IMMEDIATE_MS],
      ['truly invalid date month 13', '2024-13-01', IMMEDIATE_MS],
    ])(
      'should clear error when entering %s after error exists',
      async (_label, followUpValue, delay) => {
        const minDate = '2024-01-01';
        const maxDate = '2024-12-31';
        renderWithProps({ minDate, maxDate, onChange: mockOnChange });

        const input = getInput(DEFAULT_ID);
        fireEvent.change(input, { target: { value: '2023-12-15' } });

        await waitFor(() => {
          expect(getErrorText()).toContain('Date is not within allowed range');
        });

        fireEvent.change(input, { target: { value: followUpValue } });

        await waitForValidation(delay);
        expect(getErrorText()).toBe('');
      },
    );
  });

  describe('future date warning behavior', () => {
    test.each([
      {
        label: 'no warning when prop not set',
        threshold: undefined,
        date: '2250-06-15',
        expectWarning: false,
        expectedSnippet: '',
      },
      {
        label: 'warning when over 100 years in future',
        threshold: 100,
        date: '2250-06-15',
        expectWarning: true,
        expectedSnippet: 'more than 100 years in the future',
      },
      {
        label: 'custom threshold of 50 years',
        threshold: 50,
        date: '2100-06-15',
        expectWarning: true,
        expectedSnippet: 'more than 50 years in the future',
      },
    ])('$label', async ({ threshold, date, expectWarning, expectedSnippet }) => {
      renderWithProps({
        minDate: '2024-01-01',
        maxDate: '9999-12-31',
        futureDateWarningThresholdYears: threshold,
      });

      fireEvent.change(getInput(DEFAULT_ID), { target: { value: date } });

      await waitForValidation();

      const warningText = getWarningText();
      if (expectWarning) {
        expect(warningText).toContain(expectedSnippet);
      } else {
        expect(warningText).toBe('');
      }
    });

    test('should not show warning for dates exactly at threshold', async () => {
      renderWithProps({ onChange: mockOnChange, futureDateWarningThresholdYears: 100 });

      const inputEl = getInput(DEFAULT_ID);

      const now = new Date();
      const hundredYearsFromNow = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());
      const dateString = hundredYearsFromNow.toISOString().split('T')[0];

      fireEvent.change(inputEl, { target: { value: dateString } });

      await waitForValidation();

      expect(getWarningElement()).not.toBeInTheDocument();
    });

    test('should not show warning when there is an error', async () => {
      renderWithProps({
        minDate: '2024-01-01',
        maxDate: '2024-12-31',
        futureDateWarningThresholdYears: 100,
      });

      fireEvent.change(getInput(DEFAULT_ID), { target: { value: '2025-06-15' } });

      await waitForValidation();

      expect(getErrorText()).toContain('Date is not within allowed range');

      expect(getWarningElement()).not.toBeInTheDocument();
    });

    test('should clear warning when date is changed to within threshold', async () => {
      renderWithProps({
        minDate: '2024-01-01',
        maxDate: '9999-12-31',
        futureDateWarningThresholdYears: 100,
      });

      const inputEl = getInput(DEFAULT_ID);

      fireEvent.change(inputEl, { target: { value: '2250-06-15' } });

      await waitForValidation();

      expect(getWarningText()).toContain('more than 100 years in the future');

      fireEvent.change(inputEl, { target: { value: '2030-06-15' } });

      await waitForValidation();

      expect(getWarningText()).toBe('');
    });
  });

  test('should allow dates with years before 1900 when within minDate/maxDate range', async () => {
    const minDate = '1800-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    fireEvent.change(getInput(DEFAULT_ID), { target: { value: '1850-06-15' } });

    await waitForValidation();

    expect(getErrorText()).toBe('');
  });

  test('should clear error when entering valid date after error', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';
    renderWithProps({ minDate, maxDate, onChange: mockOnChange });

    const inputEl = getInput(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2023-12-15' } });

    await waitFor(() => {
      expect(getErrorText()).toContain('Date is not within allowed range');
    });

    fireEvent.change(inputEl, { target: { value: '2024-06-15' } });

    await waitForValidation();

    expect(getErrorText()).toBe('');
  });

  test('should handle onBlur callback', () => {
    const onBlurSpy = vi.fn();
    renderWithProps({ onBlur: onBlurSpy });

    const inputEl = getInput(DEFAULT_ID);

    fireEvent.blur(inputEl);

    expect(onBlurSpy).toHaveBeenCalledTimes(1);
  });

  test('should have default max attribute to prevent year overflow', () => {
    renderWithProps({ onChange: mockOnChange });

    const inputEl = getInput(DEFAULT_ID);

    expect(inputEl).toHaveAttribute('max', '9999-12-31');
  });

  test('should respect custom maxDate over default max', () => {
    const customMax = '2025-12-31';
    renderWithProps({ maxDate: customMax, onChange: mockOnChange });

    const inputEl = getInput(DEFAULT_ID);

    expect(inputEl).toHaveAttribute('max', customMax);
  });

  test('should run multiple custom validators and concatenate error messages', async () => {
    const minDateValidator = vi.fn((value: unknown) => {
      if (typeof value !== 'string') return { reasons: ['Must be a string'] };
      const date = new Date(value);
      const minDate = new Date('1978-01-01');
      return date < minDate
        ? { reasons: ['Date must be on or after 01/01/1978.'] }
        : { valid: true as const };
    });

    const maxDateValidator = vi.fn((value: unknown) => {
      if (typeof value !== 'string') return { reasons: ['Must be a string'] };
      const date = new Date(value);
      const maxDate = new Date('2030-12-31');
      return date > maxDate
        ? { reasons: ['Date must be on or before 12/31/2030.'] }
        : { valid: true as const };
    });

    renderWithProps({ validators: [minDateValidator, maxDateValidator], onChange: mockOnChange });

    const inputEl = getInput(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '2031-01-01' } });
    fireEvent.blur(inputEl);

    await waitFor(() => {
      expect(getErrorText()).toBe('Date must be on or before 12/31/2030.');
    });

    expect(minDateValidator).toHaveBeenCalledWith('2031-01-01');
    expect(maxDateValidator).toHaveBeenCalledWith('2031-01-01');
  });

  test('should clear custom validator errors on valid input', async () => {
    const minDateValidator = (value: unknown) => {
      if (typeof value !== 'string') return { reasons: ['Must be a string'] };
      const date = new Date(value);
      const minDate = new Date('1978-01-01');
      return date < minDate
        ? { reasons: ['Date must be on or after 01/01/1978.'] }
        : { valid: true as const };
    };

    renderWithProps({ validators: [minDateValidator], onChange: mockOnChange });

    const inputEl = getInput(DEFAULT_ID);

    fireEvent.change(inputEl, { target: { value: '1977-12-31' } });
    fireEvent.blur(inputEl);

    await waitFor(() => {
      expect(getErrorText()).toBe('Date must be on or after 01/01/1978.');
    });

    fireEvent.change(inputEl, { target: { value: '2024-01-15' } });
    fireEvent.blur(inputEl);

    await waitFor(() => {
      expect(getErrorText()).toBe('');
    });
  });
});
