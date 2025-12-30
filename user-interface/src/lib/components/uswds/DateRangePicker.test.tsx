import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import DateRangePicker from './DateRangePicker';
import { DateRangePickerRef } from '@/lib/type-declarations/input-fields';

// Test helper to reduce boilerplate
type DateRangeTestIds = {
  id: string;
};

const ERROR_TEXT = 'Start date must be before end date.';

function renderDateRangePicker(
  props: Partial<React.ComponentProps<typeof DateRangePicker>> & DateRangeTestIds,
) {
  const { id, ...rest } = props;

  const view = render(
    <DateRangePicker id={id} startDateLabel="Start Date" endDateLabel="End Date" {...rest} />,
  );

  const startInput = screen.getByTestId(`${id}-date-start`) as HTMLInputElement;
  const endInput = screen.getByTestId(`${id}-date-end`) as HTMLInputElement;

  return {
    ...view,
    startInput,
    endInput,
    expectError: () => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument(),
    expectNoError: () => expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument(),
  };
}

describe('Test DateRangePicker component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call change handlers when either date is changed', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker',
      onStartDateChange: mockHandlerStart,
      onEndDateChange: mockHandlerEnd,
    });

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });

    fireEvent.change(startInput, { target: { value: '2020-01-01' } });
    expect(mockHandlerStart).toHaveBeenCalled();

    fireEvent.change(endInput, { target: { value: '2020-01-01' } });
    expect(mockHandlerEnd).toHaveBeenCalled();
  });

  test('should set min and max attributes when minDate and maxDate is supplied', async () => {
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker',
      minDate: '2024-01-01',
      maxDate: '2025-01-01',
    });

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });
    expect(startInput).toHaveAttribute('min', '2024-01-01');
    expect(startInput).toHaveAttribute('max', '2025-01-01');
    expect(endInput).toHaveAttribute('min', '2024-01-01');
    expect(endInput).toHaveAttribute('max', '2025-01-01');
  });

  test('should maintain static min and max attributes', async () => {
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker',
      minDate: '2020-01-01',
      maxDate: '2035-01-01',
    });

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });

    // Both fields should always have the same min/max constraints
    expect(startInput).toHaveAttribute('min', '2020-01-01');
    expect(startInput).toHaveAttribute('max', '2035-01-01');
    expect(endInput).toHaveAttribute('min', '2020-01-01');
    expect(endInput).toHaveAttribute('max', '2035-01-01');

    // After entering dates, constraints should remain the same
    fireEvent.change(startInput, { target: { value: '2022-05-01' } });
    fireEvent.change(endInput, { target: { value: '2025-07-01' } });

    await waitFor(() => {
      expect(startInput).toHaveAttribute('min', '2020-01-01');
      expect(startInput).toHaveAttribute('max', '2035-01-01');
      expect(endInput).toHaveAttribute('min', '2020-01-01');
      expect(endInput).toHaveAttribute('max', '2035-01-01');
    });
  });

  test('should reset values to what was passed in props when calling resetValue()', async () => {
    const initialStartDate = '2021-01-01';
    const initialEndDate = '2028-01-23';
    const newStartDate = '2022-05-01';
    const newEndDate = '2026-01-01';

    const rangeRef = React.createRef<DateRangePickerRef>();
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker',
      value: { start: initialStartDate, end: initialEndDate },
      ref: rangeRef,
    });

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });
    expect(startInput).toHaveValue(initialStartDate);
    expect(endInput).toHaveValue(initialEndDate);

    fireEvent.change(startInput, { target: { value: newStartDate } });
    fireEvent.change(endInput, { target: { value: newEndDate } });

    act(() => rangeRef.current?.resetValue());
    await waitFor(() => {
      expect(startInput).toHaveValue(initialStartDate);
      expect(endInput).toHaveValue(initialEndDate);
    });
  });

  test('should handle aria description rendering', async () => {
    const value = { start: '2024-06-15', end: '2024-06-16' };

    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-voice',
      value,
    });

    await waitFor(() => {
      expect(startInput).toHaveValue('2024-06-15');
    });
    expect(endInput).toHaveValue('2024-06-16');
  });
});

describe('DateRangePicker additional coverage tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle disabled prop', async () => {
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-disabled',
      disabled: true,
    });

    await waitFor(() => {
      expect(startInput).toBeDisabled();
    });
    expect(endInput).toBeDisabled();
  });

  test('should handle required prop', async () => {
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-required',
      required: true,
    });

    await waitFor(() => {
      expect(startInput).toHaveAttribute('required');
    });
    expect(endInput).toHaveAttribute('required');
  });

  test('should handle aria-description', async () => {
    const ariaDescription = 'Select a date range for your search';
    renderDateRangePicker({
      id: 'date-picker-aria',
      ariaDescription,
    });

    const ariaElement = document.querySelector('#date-picker-aria-aria-description');
    await waitFor(() => {
      expect(ariaElement).toBeInTheDocument();
    });
    expect(ariaElement).toHaveAttribute('aria-live', 'polite');
    expect(ariaElement).toHaveAttribute('hidden');
  });

  test('should handle initial value prop', async () => {
    const initialValue = { start: '2024-01-01', end: '2024-12-31' };
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-value',
      value: initialValue,
    });

    await waitFor(() => {
      expect(startInput).toHaveValue(initialValue.start);
    });
    expect(endInput).toHaveValue(initialValue.end);
  });

  test('should display aria descriptions for date range', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';

    renderDateRangePicker({
      id: 'date-picker-range',
      minDate,
      maxDate,
    });

    const ariaElement = document.querySelector('#date-picker-range-aria-description');

    await waitFor(() => {
      expect(ariaElement).toHaveTextContent('Format: numeric month / numeric day / 4-digit year.');
    });

    expect(ariaElement).toHaveTextContent('within 2024-01-01 and 2024-12-31');
  });

  test('should handle ref methods', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const initialValue = { start: '2024-01-01', end: '2024-12-31' };

    const { startInput, endInput } = renderDateRangePicker({
      ref: rangeRef,
      id: 'date-picker-ref',
      value: initialValue,
    });

    await waitFor(() => {
      expect(startInput).toHaveValue(initialValue.start);
    });

    // Test setValue
    const newValue = { start: '2024-02-01', end: '2024-11-30' };
    act(() => rangeRef.current?.setValue(newValue));

    await waitFor(() => {
      expect(startInput).toHaveValue(newValue.start);
      expect(endInput).toHaveValue(newValue.end);
    });

    // Test resetValue
    act(() => rangeRef.current?.resetValue());
    await waitFor(() => {
      expect(startInput).toHaveValue(initialValue.start);
      expect(endInput).toHaveValue(initialValue.end);
    });

    // Test clearValue
    act(() => rangeRef.current?.clearValue());
    await waitFor(() => {
      expect(startInput).toHaveValue('');
      expect(endInput).toHaveValue('');
    });
  });

  test('should handle edge case with only minDate', async () => {
    const minDate = '2024-01-01';

    renderDateRangePicker({
      id: 'date-picker-min-only',
      minDate,
    });

    const ariaElement = document.querySelector('#date-picker-min-only-aria-description');
    await waitFor(() => {
      expect(ariaElement).toHaveTextContent('2024-01-01');
    });
  });

  test('should handle edge case with only maxDate', async () => {
    const maxDate = '2024-12-31';

    renderDateRangePicker({
      id: 'date-picker-max-only',
      maxDate,
    });

    const ariaElement = document.querySelector('#date-picker-max-only-aria-description');
    await waitFor(() => {
      expect(ariaElement).toHaveTextContent('Valid date range is on or before 2024-12-31');
    });
  });

  test('should handle date formatting error gracefully', async () => {
    renderDateRangePicker({
      id: 'date-picker-format',
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    });
  });

  test('should support getValue method but throw error', () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    renderDateRangePicker({
      id: 'date-picker-getvalue',
      ref: rangeRef,
    });

    expect(() => rangeRef.current?.getValue()).toThrow('Not implemented');
  });

  test('should support disable method', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-disable',
      ref: rangeRef,
    });

    await waitFor(() => {
      expect(startInput).not.toBeDisabled();
    });
    expect(endInput).not.toBeDisabled();

    act(() => rangeRef.current?.disable(true));

    await waitFor(() => {
      expect(startInput).toBeDisabled();
      expect(endInput).toBeDisabled();
    });

    act(() => rangeRef.current?.disable(false));

    await waitFor(() => {
      expect(startInput).not.toBeDisabled();
      expect(endInput).not.toBeDisabled();
    });
  });

  test('should support focus method', () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const { startInput } = renderDateRangePicker({
      id: 'date-picker-focus',
      ref: rangeRef,
    });

    rangeRef.current?.focus();

    expect(startInput).toHaveFocus();
  });

  test('should handle setValue with partial options', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-setvalue',
      ref: rangeRef,
    });

    // Set only start date
    act(() => rangeRef.current?.setValue({ start: '2024-01-01' }));
    await waitFor(() => {
      expect(startInput).toHaveValue('2024-01-01');
    });

    // Set only end date
    act(() => rangeRef.current?.setValue({ end: '2024-12-31' }));
    await waitFor(() => {
      expect(endInput).toHaveValue('2024-12-31');
    });

    // Set both
    act(() => rangeRef.current?.setValue({ start: '2024-06-01', end: '2024-06-30' }));
    await waitFor(() => {
      expect(startInput).toHaveValue('2024-06-01');
      expect(endInput).toHaveValue('2024-06-30');
    });

    // Set with empty object (should set empty strings)
    act(() => rangeRef.current?.setValue({}));
    await waitFor(() => {
      expect(startInput).toHaveValue('');
      expect(endInput).toHaveValue('');
    });
  });

  test('should handle clearValue with debounce', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-clear',
      ref: rangeRef,
    });

    // Set some values first
    act(() => rangeRef.current?.setValue({ start: '2024-01-01', end: '2024-12-31' }));
    expect(startInput).toHaveValue('2024-01-01');

    // Clear values
    act(() => rangeRef.current?.clearValue());

    // Should clear immediately
    expect(startInput).toHaveValue('');
    expect(endInput).toHaveValue('');

    // Wait for debounced clear
    await waitFor(
      () => {
        expect(startInput).toHaveValue('');
        expect(endInput).toHaveValue('');
      },
      { timeout: 300 },
    );
  });

  test('should handle resetValue method with initial values', async () => {
    const rangeRef = React.createRef<DateRangePickerRef>();
    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-reset',
      ref: rangeRef,
      value: { start: '2024-01-01', end: '2024-12-31' },
    });

    await waitFor(() => {
      expect(startInput).toHaveValue('2024-01-01');
      expect(endInput).toHaveValue('2024-12-31');
    });

    // Change the values
    act(() => rangeRef.current?.setValue({ start: '2024-06-01', end: '2024-06-30' }));
    expect(startInput).toHaveValue('2024-06-01');
    expect(endInput).toHaveValue('2024-06-30');

    // Reset should go back to original values
    act(() => rangeRef.current?.resetValue());

    expect(startInput).toHaveValue('2024-01-01');
    expect(endInput).toHaveValue('2024-12-31');
  });

  test('should handle invalid date formatting gracefully in aria description', async () => {
    const { startInput, endInput } = renderDateRangePicker({
      id: 'test-invalid-format',
      minDate: 'invalid-date-format',
    });

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });
    expect(endInput).toBeInTheDocument();

    const ariaElement = document.querySelector('#test-invalid-format-aria-description');
    expect(ariaElement).toBeInTheDocument();
  });

  test('should trigger formatDateForVoiceOver catch block with malformed date', async () => {
    const malformedDate = null;

    const { formatDateForVoiceOver } = await import('./DateRangePicker');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = formatDateForVoiceOver(malformedDate as any);

    expect(result).toBeUndefined();
  });

  test('should execute debounced clearValue calls in clearValue method', () => {
    const ref = React.createRef<DateRangePickerRef>();

    renderDateRangePicker({
      id: 'test-debounced-clear',
      ref: ref,
    });

    // Set some values first
    act(() => ref.current?.setValue({ start: '2024-01-01', end: '2024-01-31' }));

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    act(() => ref.current?.clearValue());

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

    const callback = setTimeoutSpy.mock.calls[0][0] as () => void;
    act(() => callback());
  });

  test('should handle edge case in formatDateForVoiceOver with invalid date components', async () => {
    const module = await import('./DateRangePicker');
    const { formatDateForVoiceOver } = module;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = formatDateForVoiceOver(null as any);

    expect(result).toBeUndefined();
  });

  test('should have accessible descriptions for both date fields', async () => {
    const minDate = '2024-01-01';
    const maxDate = '2024-12-31';

    const { startInput, endInput } = renderDateRangePicker({
      id: 'test-date-range',
      minDate,
      maxDate,
    });

    await waitFor(() => {
      expect(startInput).toBeInTheDocument();
    });

    expect(startInput).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('test-date-range-start-hint'),
    );
    expect(endInput).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('test-date-range-end-hint'),
    );

    const startHint = document.getElementById('test-date-range-start-hint');
    const endHint = document.getElementById('test-date-range-end-hint');

    expect(startHint).toBeInTheDocument();
    expect(endHint).toBeInTheDocument();

    expect(startHint).toHaveTextContent('Enter the beginning date for the range');
    expect(startHint).toHaveTextContent('MM/DD/YYYY');
    expect(startHint).toHaveTextContent(
      'Valid dates are between January 1, 2024 and December 31, 2024',
    );

    expect(endHint).toHaveTextContent('Enter the ending date for the range');
    expect(endHint).toHaveTextContent('MM/DD/YYYY');
    expect(endHint).toHaveTextContent(
      'Valid dates are between January 1, 2024 and December 31, 2024',
    );
  });

  test('should pass futureDateWarningThresholdYears to child DatePickers', async () => {
    const { endInput } = renderDateRangePicker({
      id: 'test-date-range',
      futureDateWarningThresholdYears: 100,
    });

    fireEvent.change(endInput, { target: { value: '2250-06-15' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const warningElement = document.querySelector('.date-warning');
    expect(warningElement).toBeInTheDocument();
    expect(warningElement?.textContent).toContain('more than 100 years in the future');
  });
});

describe('DateRangePicker validation tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('date range validation', () => {
    it.each([
      {
        name: 'valid range',
        start: '2024-01-01',
        end: '2024-12-31',
        expectError: false,
      },
      {
        name: 'start after end',
        start: '2024-12-31',
        end: '2024-01-01',
        expectError: true,
      },
      {
        name: 'same start and end is valid',
        start: '2024-06-15',
        end: '2024-06-15',
        expectError: false,
      },
    ])('should handle $name', async ({ start, end, expectError }) => {
      const { startInput, endInput } = renderDateRangePicker({
        id: 'date-picker-validations',
      });

      fireEvent.change(startInput, { target: { value: start } });
      fireEvent.change(endInput, { target: { value: end } });

      await waitFor(() => {
        const error = screen.queryByText(ERROR_TEXT);
        if (expectError) {
          expect(error).toBeInTheDocument();
        } else {
          expect(error).not.toBeInTheDocument();
        }
      });
    });

    it.each([
      {
        name: 'incomplete start date',
        start: '2024-12',
        end: '2024-01-01',
        expectError: false,
      },
      {
        name: 'incomplete end date',
        start: '2024-12-31',
        end: '2024-01',
        expectError: false,
      },
      {
        name: 'invalid start date format',
        start: 'invalid-date',
        end: '2024-01-01',
        expectError: false,
      },
      {
        name: 'invalid end date format',
        start: '2024-12-31',
        end: 'also-invalid',
        expectError: false,
      },
    ])('should not validate $name', async ({ start, end, expectError }) => {
      const { startInput, endInput } = renderDateRangePicker({
        id: 'date-picker-incomplete',
      });

      fireEvent.change(startInput, { target: { value: start } });
      fireEvent.change(endInput, { target: { value: end } });

      await waitFor(() => {
        const error = screen.queryByText(ERROR_TEXT);
        if (expectError) {
          expect(error).toBeInTheDocument();
        } else {
          expect(error).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('blur validation', () => {
    it.each([
      {
        name: 'start blur with empty end does not validate',
        changeField: 'start' as const,
        blurField: 'start' as const,
        start: '2024-12-31',
        end: '',
        expectError: false,
      },
      {
        name: 'end blur with empty start does not validate',
        changeField: 'end' as const,
        blurField: 'end' as const,
        start: '',
        end: '2024-01-01',
        expectError: false,
      },
      {
        name: 'start blur with invalid range shows error',
        changeField: 'both' as const,
        blurField: 'start' as const,
        start: '2024-12-31',
        end: '2024-01-01',
        expectError: true,
      },
      {
        name: 'end blur with invalid range shows error',
        changeField: 'both' as const,
        blurField: 'end' as const,
        start: '2024-12-31',
        end: '2024-01-01',
        expectError: true,
      },
    ])('should handle $name', async (cfg) => {
      const { startInput, endInput } = renderDateRangePicker({
        id: 'date-picker-blur-cases',
      });

      if (cfg.changeField === 'start' || cfg.changeField === 'both') {
        fireEvent.change(startInput, { target: { value: cfg.start } });
      }
      if (cfg.changeField === 'end' || cfg.changeField === 'both') {
        fireEvent.change(endInput, { target: { value: cfg.end } });
      }

      fireEvent.blur(cfg.blurField === 'start' ? startInput : endInput);

      await waitFor(() => {
        const error = screen.queryByText(ERROR_TEXT);
        if (cfg.expectError) {
          expect(error).toBeInTheDocument();
        } else {
          expect(error).not.toBeInTheDocument();
        }
      });
    });
  });

  test('should clear errors when user changes start date', async () => {
    const { startInput, endInput, expectError, expectNoError } = renderDateRangePicker({
      id: 'date-picker-clear-error-start',
    });

    fireEvent.change(endInput, { target: { value: '2024-01-01' } });
    fireEvent.change(startInput, { target: { value: '2024-12-31' } });

    await waitFor(expectError);

    fireEvent.change(startInput, { target: { value: '2023-12-31' } });

    await waitFor(expectNoError);
  });

  test('should clear errors when user changes end date', async () => {
    const { startInput, endInput, expectError, expectNoError } = renderDateRangePicker({
      id: 'date-picker-clear-error-end',
    });

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });

    await waitFor(expectError);

    fireEvent.change(endInput, { target: { value: '2025-01-01' } });

    await waitFor(expectNoError);
  });

  test('should call onStartDateChange handler before validation', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();

    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-handler-order',
      onStartDateChange: mockHandlerStart,
      onEndDateChange: mockHandlerEnd,
    });

    fireEvent.change(endInput, { target: { value: '2024-01-01' } });
    expect(mockHandlerEnd).toHaveBeenCalledTimes(1);

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });

    expect(mockHandlerStart).toHaveBeenCalledTimes(1);
    expect(mockHandlerStart).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2024-12-31' }) }),
    );
  });

  test('should call onEndDateChange handler before validation', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();

    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-handler-order-end',
      onStartDateChange: mockHandlerStart,
      onEndDateChange: mockHandlerEnd,
    });

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });
    expect(mockHandlerStart).toHaveBeenCalledTimes(1);

    fireEvent.change(endInput, { target: { value: '2024-01-01' } });

    expect(mockHandlerEnd).toHaveBeenCalledTimes(1);
    expect(mockHandlerEnd).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2024-01-01' }) }),
    );
  });

  test('should clear both error states when start date changes', async () => {
    const { startInput, endInput, expectError, expectNoError } = renderDateRangePicker({
      id: 'date-picker-clear-both-start',
    });

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });

    await waitFor(expectError);

    fireEvent.change(startInput, { target: { value: '2024-01' } });

    await waitFor(expectNoError);
  });

  test('should clear both error states when end date changes', async () => {
    const { startInput, endInput, expectError, expectNoError } = renderDateRangePicker({
      id: 'date-picker-clear-both-end',
    });

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });

    await waitFor(expectError);

    fireEvent.change(endInput, { target: { value: '2024-01' } });

    await waitFor(expectNoError);
  });

  test('should clear errors when clearValue is called', async () => {
    const ref = React.createRef<DateRangePickerRef>();

    const { startInput, endInput, expectError, expectNoError } = renderDateRangePicker({
      id: 'date-picker-clear-errors',
      ref,
    });

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });

    await waitFor(expectError);

    act(() => ref.current?.clearValue());

    await waitFor(expectNoError);
  });

  test('should clear errors when resetValue is called', async () => {
    const ref = React.createRef<DateRangePickerRef>();

    const { startInput, endInput, expectError, expectNoError } = renderDateRangePicker({
      id: 'date-picker-reset-errors',
      ref,
      value: { start: '2024-01-01', end: '2024-12-31' },
    });

    fireEvent.change(startInput, { target: { value: '2024-12-31' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });

    await waitFor(expectError);

    act(() => ref.current?.resetValue());

    await waitFor(expectNoError);
  });

  test('should execute debounced clearValue callback', () => {
    vi.useFakeTimers();
    const ref = React.createRef<DateRangePickerRef>();

    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker-debounce-clear',
      ref,
      value: { start: '2024-01-01', end: '2024-12-31' },
    });

    expect(startInput.value).toBe('2024-01-01');
    expect(endInput.value).toBe('2024-12-31');

    act(() => {
      ref.current?.clearValue();
    });

    expect(startInput.value).toBe('');
    expect(endInput.value).toBe('');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(startInput.value).toBe('');
    expect(endInput.value).toBe('');

    vi.useRealTimers();
  });

  test('should pass custom validators to start and end date pickers', async () => {
    const startDateValidator = vi.fn((value: string) => {
      const date = new Date(value);
      const minDate = new Date('1978-01-01');
      return date < minDate ? 'Start date must be on or after 01/01/1978.' : null;
    });

    const endDateValidator = vi.fn((value: string) => {
      const date = new Date(value);
      const maxDate = new Date('2030-12-31');
      return date > maxDate ? 'End date must be on or before 12/31/2030.' : null;
    });

    const { startInput, endInput } = renderDateRangePicker({
      id: 'date-picker',
      startDateValidators: [startDateValidator],
      endDateValidators: [endDateValidator],
    });

    fireEvent.change(startInput, { target: { value: '1977-12-31' } });
    fireEvent.blur(startInput);

    await waitFor(() => {
      expect(startDateValidator).toHaveBeenCalledWith('1977-12-31');
      expect(screen.getByText('Start date must be on or after 01/01/1978.')).toBeInTheDocument();
    });

    fireEvent.change(endInput, { target: { value: '2031-01-01' } });
    fireEvent.blur(endInput);

    await waitFor(() => {
      expect(endDateValidator).toHaveBeenCalledWith('2031-01-01');
      expect(screen.getByText('End date must be on or before 12/31/2030.')).toBeInTheDocument();
    });
  });
});
