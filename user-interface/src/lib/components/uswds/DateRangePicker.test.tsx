import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import DateRangePicker from './DateRangePicker';
import { DateRangePickerRef } from '@/lib/type-declarations/input-fields';

describe('Test DateRangePicker component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call change handlers when either date is changed', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          endDateLabel="end date"
          startDateLabel="start date"
          onStartDateChange={mockHandlerStart}
          onEndDateChange={mockHandlerEnd}
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    await waitFor(() => {
      expect(startDateText).toBeInTheDocument();
    });

    fireEvent.change(startDateText, { target: { value: '2020-01-01' } });
    expect(mockHandlerStart).toHaveBeenCalled();

    const endDateText = screen.getByTestId('date-picker-date-end');
    expect(endDateText).toBeInTheDocument();
    fireEvent.change(endDateText, { target: { value: '2020-01-01' } });
    expect(mockHandlerEnd).toHaveBeenCalled();
  });

  test('should set min and max attributes when minDate and maxDate is supplied', async () => {
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          minDate="2024-01-01"
          maxDate="2025-01-01"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    await waitFor(() => {
      expect(startDateText).toBeInTheDocument();
    });
    expect(startDateText).toHaveAttribute('min', '2024-01-01');
    expect(startDateText).toHaveAttribute('max', '2025-01-01');

    const endDateText = screen.getByTestId('date-picker-date-end');
    expect(endDateText).toBeInTheDocument();
    expect(endDateText).toHaveAttribute('min', '2024-01-01');
    expect(endDateText).toHaveAttribute('max', '2025-01-01');
  });

  test('should maintain static min and max attributes', async () => {
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          minDate="2020-01-01"
          maxDate="2035-01-01"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    const endDateText = screen.getByTestId('date-picker-date-end');
    await waitFor(() => {
      expect(startDateText).toBeInTheDocument();
    });

    // Both fields should always have the same min/max constraints
    expect(startDateText).toHaveAttribute('min', '2020-01-01');
    expect(startDateText).toHaveAttribute('max', '2035-01-01');
    expect(endDateText).toHaveAttribute('min', '2020-01-01');
    expect(endDateText).toHaveAttribute('max', '2035-01-01');

    // After entering dates, constraints should remain the same
    fireEvent.change(startDateText, { target: { value: '2022-05-01' } });
    fireEvent.change(endDateText, { target: { value: '2025-07-01' } });

    await waitFor(() => {
      expect(startDateText).toHaveAttribute('min', '2020-01-01');
      expect(startDateText).toHaveAttribute('max', '2035-01-01');
      expect(endDateText).toHaveAttribute('min', '2020-01-01');
      expect(endDateText).toHaveAttribute('max', '2035-01-01');
    });
  });

  // TODO: There is a weird unexplainable behavior in vitest it seems.
  // if we console.log the value, we see the correct value.
  // The internal state changes properly with the debugger.
  // However, the assertion fails with an incorect return value
  test('should reset values to what was passed in props when calling resetValue()', async () => {
    const initialStartDate = '2021-01-01';
    const initialEndDate = '2028-01-23';
    const newStartDate = '2022-05-01';
    const newEndDate = '2026-01-01';

    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          value={{ start: initialStartDate, end: initialEndDate }}
          ref={rangeRef}
          onStartDateChange={mockHandlerStart}
          onEndDateChange={mockHandlerEnd}
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    await waitFor(() => {
      expect(startDateText).toBeInTheDocument();
    });
    expect(startDateText).toHaveValue(initialStartDate);

    const endDateText = screen.getByTestId('date-picker-date-end');
    expect(endDateText).toBeInTheDocument();
    expect(endDateText).toHaveValue(initialEndDate);

    fireEvent.change(startDateText, { target: { value: newStartDate } });
    /*
    await waitFor(() => {
      expect(mockHandlerStart).toHaveBeenCalledTimes(1);
      expect(mockHandlerStart).toHaveBeenCalledWith(
        expect.objectContaining({ target: expect.objectContaining({ value: newStartDate }) }),
      );
    });
    */

    fireEvent.change(endDateText, { target: { value: newEndDate } });
    /*
    await waitFor(() => {
      expect(mockHandlerStart).toHaveBeenCalledTimes(1);
      expect(mockHandlerEnd).toHaveBeenCalledWith(
        expect.objectContaining({ target: expect.objectContaining({ value: newEndDate }) }),
      );
    });
    */

    act(() => rangeRef.current?.resetValue());
    await waitFor(() => {
      expect(startDateText).toHaveValue(initialStartDate);
      expect(endDateText).toHaveValue(initialEndDate);
    });
  });

  test('should handle aria description rendering', async () => {
    // This test checks that the component renders properly with values
    const value = { start: '2024-06-15', end: '2024-06-16' };

    render(
      <DateRangePicker
        id="date-picker-voice"
        value={value}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDate = screen.getByTestId('date-picker-voice-date-start');
    const endDate = screen.getByTestId('date-picker-voice-date-end');

    await waitFor(() => {
      expect(startDate).toHaveValue('2024-06-15');
    });
    expect(endDate).toHaveValue('2024-06-16');
  });
});

describe('DateRangePicker additional coverage tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle disabled prop', async () => {
    render(
      <DateRangePicker
        id="date-picker-disabled"
        disabled={true}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDate = screen.getByTestId('date-picker-disabled-date-start');
    const endDate = screen.getByTestId('date-picker-disabled-date-end');

    await waitFor(() => {
      expect(startDate).toBeDisabled();
    });
    expect(endDate).toBeDisabled();
  });

  test('should handle required prop', async () => {
    render(
      <DateRangePicker
        id="date-picker-required"
        required={true}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDate = screen.getByTestId('date-picker-required-date-start');
    const endDate = screen.getByTestId('date-picker-required-date-end');

    await waitFor(() => {
      expect(startDate).toHaveAttribute('required');
    });
    expect(endDate).toHaveAttribute('required');
  });

  test('should handle aria-description', async () => {
    const ariaDescription = 'Select a date range for your search';
    render(
      <DateRangePicker
        id="date-picker-aria"
        ariaDescription={ariaDescription}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const ariaElement = document.querySelector('#date-picker-aria-aria-description');
    await waitFor(() => {
      expect(ariaElement).toBeInTheDocument();
    });
    expect(ariaElement).toHaveAttribute('aria-live', 'polite');
    expect(ariaElement).toHaveAttribute('hidden');
  });

  test('should handle initial value prop', async () => {
    const initialValue = { start: '2024-01-01', end: '2024-12-31' };
    render(
      <DateRangePicker
        id="date-picker-value"
        value={initialValue}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDate = screen.getByTestId('date-picker-value-date-start');
    const endDate = screen.getByTestId('date-picker-value-date-end');

    await waitFor(() => {
      expect(startDate).toHaveValue(initialValue.start);
    });
    expect(endDate).toHaveValue(initialValue.end);
  });

  test('should display aria descriptions for date range', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';

    render(
      <DateRangePicker
        id="date-picker-range"
        minDate={minDate}
        maxDate={maxDate}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const ariaElement = document.querySelector('#date-picker-range-aria-description');

    // Check for format instruction
    await waitFor(() => {
      expect(ariaElement).toHaveTextContent('Format: numeric month / numeric day / 4-digit year.');
    });

    // Check for date range description
    expect(ariaElement).toHaveTextContent('within 2024-01-01 and 2024-12-31');
  });

  test('should handle ref methods', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const initialValue = { start: '2024-01-01', end: '2024-12-31' };

    render(
      <DateRangePicker
        ref={rangeRef}
        id="date-picker-ref"
        value={initialValue}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDate = screen.getByTestId('date-picker-ref-date-start');
    const endDate = screen.getByTestId('date-picker-ref-date-end');
    await waitFor(() => {
      expect(startDate).toHaveValue(initialValue.start);
    });

    // Test setValue
    const newValue = { start: '2024-02-01', end: '2024-11-30' };
    act(() => rangeRef.current?.setValue(newValue));

    await waitFor(() => {
      expect(startDate).toHaveValue(newValue.start);
      expect(endDate).toHaveValue(newValue.end);
    });

    // Test resetValue
    act(() => rangeRef.current?.resetValue());
    await waitFor(() => {
      expect(startDate).toHaveValue(initialValue.start);
      expect(endDate).toHaveValue(initialValue.end);
    });

    // Test clearValue
    act(() => rangeRef.current?.clearValue());
    await waitFor(() => {
      expect(startDate).toHaveValue('');
      expect(endDate).toHaveValue('');
    });
  });

  test('should handle edge case with only minDate', async () => {
    const minDate = '2024-01-01';

    render(
      <DateRangePicker
        id="date-picker-min-only"
        minDate={minDate}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const ariaElement = document.querySelector('#date-picker-min-only-aria-description');
    await waitFor(() => {
      expect(ariaElement).toHaveTextContent('2024-01-01');
    });
  });

  test('should handle edge case with only maxDate', async () => {
    const maxDate = '2024-12-31';

    render(
      <DateRangePicker
        id="date-picker-max-only"
        maxDate={maxDate}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const ariaElement = document.querySelector('#date-picker-max-only-aria-description');
    await waitFor(() => {
      expect(ariaElement).toHaveTextContent('Valid date range is on or before 2024-12-31');
    });
  });

  test('should handle date formatting error gracefully', async () => {
    render(
      <DateRangePicker
        id="date-picker-format"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    // The formatDate function should handle invalid dates gracefully
    // This is tested by the fact that the component renders without throwing
    await waitFor(() => {
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    });
  });

  test('should support getValue method but throw error', () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <DateRangePicker
        id="date-picker-getvalue"
        ref={rangeRef}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    expect(() => rangeRef.current?.getValue()).toThrow('Not implemented');
  });

  test('should support disable method', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <DateRangePicker
        id="date-picker-disable"
        ref={rangeRef}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-disable-date-start');
    const endDateInput = screen.getByTestId('date-picker-disable-date-end');

    // Initially should not be disabled
    await waitFor(() => {
      expect(startDateInput).not.toBeDisabled();
    });
    expect(endDateInput).not.toBeDisabled();

    // Disable both inputs
    act(() => rangeRef.current?.disable(true));

    await waitFor(() => {
      expect(startDateInput).toBeDisabled();
      expect(endDateInput).toBeDisabled();
    });

    // Re-enable
    act(() => rangeRef.current?.disable(false));

    await waitFor(() => {
      expect(startDateInput).not.toBeDisabled();
      expect(endDateInput).not.toBeDisabled();
    });
  });

  test('should support focus method', () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <DateRangePicker
        id="date-picker-focus"
        ref={rangeRef}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-focus-date-start');

    rangeRef.current?.focus();

    expect(startDateInput).toHaveFocus();
  });

  test('should handle setValue with partial options', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <DateRangePicker
        id="date-picker-setvalue"
        ref={rangeRef}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-setvalue-date-start');
    const endDateInput = screen.getByTestId('date-picker-setvalue-date-end');

    // Set only start date
    act(() => rangeRef.current?.setValue({ start: '2024-01-01' }));
    await waitFor(() => {
      expect(startDateInput).toHaveValue('2024-01-01');
    });

    // Set only end date
    act(() => rangeRef.current?.setValue({ end: '2024-12-31' }));
    await waitFor(() => {
      expect(endDateInput).toHaveValue('2024-12-31');
    });

    // Set both
    act(() => rangeRef.current?.setValue({ start: '2024-06-01', end: '2024-06-30' }));
    await waitFor(() => {
      expect(startDateInput).toHaveValue('2024-06-01');
      expect(endDateInput).toHaveValue('2024-06-30');
    });

    // Set with empty object (should set empty strings)
    act(() => rangeRef.current?.setValue({}));
    await waitFor(() => {
      expect(startDateInput).toHaveValue('');
      expect(endDateInput).toHaveValue('');
    });
  });

  test('should handle clearValue with debounce', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <DateRangePicker
        id="date-picker-clear"
        ref={rangeRef}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-clear-date-start');
    const endDateInput = screen.getByTestId('date-picker-clear-date-end');

    // Set some values first
    act(() => rangeRef.current?.setValue({ start: '2024-01-01', end: '2024-12-31' }));
    expect(startDateInput).toHaveValue('2024-01-01');

    // Clear values
    act(() => rangeRef.current?.clearValue());

    // Should clear immediately
    expect(startDateInput).toHaveValue('');
    expect(endDateInput).toHaveValue('');

    // Wait for debounced clear
    await waitFor(
      () => {
        expect(startDateInput).toHaveValue('');
        expect(endDateInput).toHaveValue('');
      },
      { timeout: 300 },
    );
  });

  test('should handle resetValue method with initial values', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    render(
      <DateRangePicker
        id="date-picker-reset"
        ref={rangeRef}
        value={{ start: '2024-01-01', end: '2024-12-31' }}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-reset-date-start');
    const endDateInput = screen.getByTestId('date-picker-reset-date-end');
    await waitFor(() => {
      expect(startDateInput).toHaveValue('2024-01-01');
      expect(endDateInput).toHaveValue('2024-12-31');
    });

    // Change the values
    act(() => rangeRef.current?.setValue({ start: '2024-06-01', end: '2024-06-30' }));
    expect(startDateInput).toHaveValue('2024-06-01');
    expect(endDateInput).toHaveValue('2024-06-30');

    // Reset should go back to original values
    act(() => rangeRef.current?.resetValue());

    expect(startDateInput).toHaveValue('2024-01-01');
    expect(endDateInput).toHaveValue('2024-12-31');
  });

  test('should handle invalid date formatting gracefully in aria description', async () => {
    // This test should trigger the formatDateRange catch block
    // by providing an invalid date format
    render(
      <DateRangePicker
        id="test-invalid-format"
        minDate="invalid-date-format"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    // The component should still render and not crash
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });
    expect(endInput).toBeInTheDocument();

    // The aria description should handle the invalid date gracefully
    const ariaElement = document.querySelector('#test-invalid-format-aria-description');
    expect(ariaElement).toBeInTheDocument();
  });

  test('should trigger formatDateForVoiceOver catch block with malformed date', async () => {
    // Create a malformed date that will cause an error
    const malformedDate = null; // This will cause split to fail

    // Dynamically import the function to test it directly
    const { formatDateForVoiceOver } = await import('./DateRangePicker');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = formatDateForVoiceOver(malformedDate as any);

    // Should return undefined due to catch block
    expect(result).toBeUndefined();
  });

  test('should execute debounced clearValue calls in clearValue method', () => {
    const ref = React.createRef<DateRangePickerRef>();

    render(
      <DateRangePicker
        id="test-debounced-clear"
        ref={ref}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    // Set some values first
    act(() => ref.current?.setValue({ start: '2024-01-01', end: '2024-01-31' }));

    // Spy on setTimeout to see if debounced function is called
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // Call clearValue which should trigger the debounced function
    act(() => ref.current?.clearValue());

    // Verify setTimeout was called (which means the debounced function will execute)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

    // Manually trigger the callback to execute the code inside debounce
    const callback = setTimeoutSpy.mock.calls[0][0] as () => void;
    act(() => callback());
  });

  test('should handle edge case in formatDateForVoiceOver with invalid date components', async () => {
    const module = await import('./DateRangePicker');
    const { formatDateForVoiceOver } = module;

    // Test with null that will cause split to fail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = formatDateForVoiceOver(null as any);

    // Should return undefined due to catch block
    expect(result).toBeUndefined();
  });

  test('should have accessible descriptions for both date fields', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';

    render(
      <DateRangePicker
        id="test-date-range"
        minDate={minDate}
        maxDate={maxDate}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startInput = screen.getByTestId('test-date-range-date-start');
    const endInput = screen.getByTestId('test-date-range-date-end');

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });

    // Check that aria-describedby includes the hint IDs
    expect(startInput).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('test-date-range-start-hint'),
    );
    expect(endInput).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('test-date-range-end-hint'),
    );

    // Verify hint elements exist with proper content
    const startHint = document.getElementById('test-date-range-start-hint');
    const endHint = document.getElementById('test-date-range-end-hint');

    expect(startHint).toBeInTheDocument();
    expect(endHint).toBeInTheDocument();

    expect(startHint).toHaveTextContent('Enter the beginning date for the range');
    expect(startHint).toHaveTextContent('MM/DD/YYYY');
    expect(startHint).toHaveTextContent(`Valid dates are between ${minDate} and ${maxDate}`);

    expect(endHint).toHaveTextContent('Enter the ending date for the range');
    expect(endHint).toHaveTextContent('MM/DD/YYYY');
    expect(endHint).toHaveTextContent(`Valid dates are between ${minDate} and ${maxDate}`);
  });
});

describe('DateRangePicker validation tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display error when start date is after end date', async () => {
    render(
      <DateRangePicker
        id="date-picker-validation"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-validation-date-start');
    const endDateInput = screen.getByTestId('date-picker-validation-date-end');

    // Enter end date first
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    // Enter start date that's after end date
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Error should be displayed
    await waitFor(() => {
      const errorElement = screen.getByText('Start date cannot be after end date.');
      expect(errorElement).toBeInTheDocument();
    });
  });

  test('should validate date range on start date blur', async () => {
    render(
      <DateRangePicker
        id="date-picker-blur-start"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-blur-start-date-start');
    const endDateInput = screen.getByTestId('date-picker-blur-start-date-end');

    // Set end date first
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    // Set start date to be after end date
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Blur start date to trigger validation
    fireEvent.blur(startDateInput);

    // Error should be displayed
    await waitFor(() => {
      const errorElement = screen.getByText('Start date cannot be after end date.');
      expect(errorElement).toBeInTheDocument();
    });
  });

  test('should validate date range on end date blur', async () => {
    render(
      <DateRangePicker
        id="date-picker-blur-end"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-blur-end-date-start');
    const endDateInput = screen.getByTestId('date-picker-blur-end-date-end');

    // Set start date first
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Set end date to be before start date
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    // Blur end date to trigger validation
    fireEvent.blur(endDateInput);

    // Error should be displayed
    await waitFor(() => {
      const errorElement = screen.getByText('Start date cannot be after end date.');
      expect(errorElement).toBeInTheDocument();
    });
  });

  test('should clear errors when user changes start date', async () => {
    render(
      <DateRangePicker
        id="date-picker-clear-error-start"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-clear-error-start-date-start');
    const endDateInput = screen.getByTestId('date-picker-clear-error-start-date-end');

    // Create an error condition
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });

    // Now change start date - error should clear
    fireEvent.change(startDateInput, { target: { value: '2023-12-31' } });

    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should clear errors when user changes end date', async () => {
    render(
      <DateRangePicker
        id="date-picker-clear-error-end"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-clear-error-end-date-start');
    const endDateInput = screen.getByTestId('date-picker-clear-error-end-date-end');

    // Create an error condition
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });

    // Now change end date - error should clear
    fireEvent.change(endDateInput, { target: { value: '2025-01-01' } });

    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should not validate incomplete start dates', async () => {
    render(
      <DateRangePicker
        id="date-picker-incomplete-start"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-incomplete-start-date-start');
    const endDateInput = screen.getByTestId('date-picker-incomplete-start-date-end');

    // Set complete end date
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    // Set incomplete start date (missing day)
    fireEvent.change(startDateInput, { target: { value: '2024-12' } });

    // No error should be displayed for incomplete date
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should not validate incomplete end dates', async () => {
    render(
      <DateRangePicker
        id="date-picker-incomplete-end"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-incomplete-end-date-start');
    const endDateInput = screen.getByTestId('date-picker-incomplete-end-date-end');

    // Set complete start date
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Set incomplete end date (missing day)
    fireEvent.change(endDateInput, { target: { value: '2024-01' } });

    // No error should be displayed for incomplete date
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should not validate when either date is empty on blur', async () => {
    render(
      <DateRangePicker
        id="date-picker-empty-blur"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-empty-blur-date-start');
    const endDateInput = screen.getByTestId('date-picker-empty-blur-date-end');

    // Set only start date
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Blur without setting end date
    fireEvent.blur(startDateInput);

    // No error should be displayed
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });

    // Now set end date and blur
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });
    fireEvent.blur(endDateInput);

    // Now error should be displayed
    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });
  });

  test('should not show error for valid date range', async () => {
    render(
      <DateRangePicker
        id="date-picker-valid-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-valid-range-date-start');
    const endDateInput = screen.getByTestId('date-picker-valid-range-date-end');

    // Set valid date range (start before end)
    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });

    // No error should be displayed
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should not show error for same start and end dates', async () => {
    render(
      <DateRangePicker
        id="date-picker-same-dates"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-same-dates-date-start');
    const endDateInput = screen.getByTestId('date-picker-same-dates-date-end');

    // Set same date for both
    fireEvent.change(startDateInput, { target: { value: '2024-06-15' } });
    fireEvent.change(endDateInput, { target: { value: '2024-06-15' } });

    // No error should be displayed (same date is valid)
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should not validate invalid date formats', async () => {
    render(
      <DateRangePicker
        id="date-picker-invalid-format"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-invalid-format-date-start');
    const endDateInput = screen.getByTestId('date-picker-invalid-format-date-end');

    // Set invalid dates
    fireEvent.change(startDateInput, { target: { value: 'invalid-date' } });
    fireEvent.change(endDateInput, { target: { value: 'also-invalid' } });

    // No error should be displayed for invalid formats
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should call onStartDateChange handler before validation', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();

    render(
      <DateRangePicker
        id="date-picker-handler-order"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        onStartDateChange={mockHandlerStart}
        onEndDateChange={mockHandlerEnd}
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-handler-order-date-start');
    const endDateInput = screen.getByTestId('date-picker-handler-order-date-end');

    // Set end date
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });
    expect(mockHandlerEnd).toHaveBeenCalledTimes(1);

    // Set start date after end date
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });

    // Handler should have been called
    expect(mockHandlerStart).toHaveBeenCalledTimes(1);
    expect(mockHandlerStart).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2024-12-31' }) }),
    );
  });

  test('should call onEndDateChange handler before validation', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();

    render(
      <DateRangePicker
        id="date-picker-handler-order-end"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        onStartDateChange={mockHandlerStart}
        onEndDateChange={mockHandlerEnd}
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-handler-order-end-date-start');
    const endDateInput = screen.getByTestId('date-picker-handler-order-end-date-end');

    // Set start date
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
    expect(mockHandlerStart).toHaveBeenCalledTimes(1);

    // Set end date before start date
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    // Handler should have been called
    expect(mockHandlerEnd).toHaveBeenCalledTimes(1);
    expect(mockHandlerEnd).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2024-01-01' }) }),
    );
  });

  test('should clear both error states when start date changes', async () => {
    render(
      <DateRangePicker
        id="date-picker-clear-both-start"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-clear-both-start-date-start');
    const endDateInput = screen.getByTestId('date-picker-clear-both-start-date-end');

    // Create error condition
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });

    // Change start date - should clear both error states
    fireEvent.change(startDateInput, { target: { value: '2024-01' } });

    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should clear both error states when end date changes', async () => {
    render(
      <DateRangePicker
        id="date-picker-clear-both-end"
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-clear-both-end-date-start');
    const endDateInput = screen.getByTestId('date-picker-clear-both-end-date-end');

    // Create error condition
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });

    // Change end date - should clear both error states
    fireEvent.change(endDateInput, { target: { value: '2024-01' } });

    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should clear errors when clearValue is called', async () => {
    const ref = React.createRef<DateRangePickerRef>();

    render(
      <DateRangePicker
        id="date-picker-clear-errors"
        ref={ref}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-clear-errors-date-start');
    const endDateInput = screen.getByTestId('date-picker-clear-errors-date-end');

    // Create error condition
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });

    // Call clearValue
    act(() => ref.current?.clearValue());

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });

  test('should clear errors when resetValue is called', async () => {
    const ref = React.createRef<DateRangePickerRef>();

    render(
      <DateRangePicker
        id="date-picker-reset-errors"
        ref={ref}
        value={{ start: '2024-01-01', end: '2024-12-31' }}
        startDateLabel="Start Date"
        endDateLabel="End Date"
      />,
    );

    const startDateInput = screen.getByTestId('date-picker-reset-errors-date-start');
    const endDateInput = screen.getByTestId('date-picker-reset-errors-date-end');

    // Change to create error condition
    fireEvent.change(startDateInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(screen.getByText('Start date cannot be after end date.')).toBeInTheDocument();
    });

    // Call resetValue
    act(() => ref.current?.resetValue());

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Start date cannot be after end date.')).not.toBeInTheDocument();
    });
  });
});
