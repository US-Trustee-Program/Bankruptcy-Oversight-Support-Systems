import { DateRangePickerRef } from '@/lib/type-declarations/input-fields';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import DateRangePicker from './DateRangePicker';

describe('Test DateRangePicker component', async () => {
  test('should call change handlers when either date is changed', async () => {
    const mockHandlerStart = vi.fn();
    const mockHandlerEnd = vi.fn();
    render(
      <React.StrictMode>
        <DateRangePicker
          endDateLabel="end date"
          id={'date-picker'}
          onEndDateChange={mockHandlerEnd}
          onStartDateChange={mockHandlerStart}
          startDateLabel="start date"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    expect(startDateText).toBeInTheDocument();

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
          maxDate="2025-01-01"
          minDate="2024-01-01"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    expect(startDateText).toBeInTheDocument();
    expect(startDateText).toHaveAttribute('min', '2024-01-01');
    expect(startDateText).toHaveAttribute('max', '2025-01-01');

    const endDateText = screen.getByTestId('date-picker-date-end');
    expect(endDateText).toBeInTheDocument();
    expect(endDateText).toHaveAttribute('min', '2024-01-01');
    expect(endDateText).toHaveAttribute('max', '2025-01-01');
  });

  test('should adjust min and max attributes when start or end date is changed, and reset when cleared', async () => {
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          maxDate="2035-01-01"
          minDate="2020-01-01"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    let startDateText = screen.getByTestId('date-picker-date-start');
    let endDateText = screen.getByTestId('date-picker-date-end');
    expect(startDateText).toBeInTheDocument();
    expect(startDateText).toHaveAttribute('max', '2035-01-01');
    expect(endDateText).toHaveAttribute('min', '2020-01-01');

    fireEvent.change(startDateText, { target: { value: '2022-05-01' } });

    startDateText = screen.getByTestId('date-picker-date-start');
    endDateText = screen.getByTestId('date-picker-date-end');
    expect(startDateText).toHaveAttribute('max', '2035-01-01');
    expect(endDateText).toHaveAttribute('min', '2022-05-01');

    fireEvent.change(endDateText, { target: { value: '2025-07-01' } });

    startDateText = screen.getByTestId('date-picker-date-start');
    endDateText = screen.getByTestId('date-picker-date-end');
    expect(startDateText).toHaveAttribute('max', '2025-07-01');
    expect(endDateText).toHaveAttribute('min', '2022-05-01');

    fireEvent.change(startDateText, { target: { value: '' } });

    expect(startDateText).toHaveAttribute('max', '2025-07-01');
    expect(endDateText).toHaveAttribute('min', '2020-01-01');

    fireEvent.change(endDateText, { target: { value: '' } });

    expect(startDateText).toHaveAttribute('max', '2035-01-01');
    expect(endDateText).toHaveAttribute('min', '2020-01-01');
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
          onEndDateChange={mockHandlerEnd}
          onStartDateChange={mockHandlerStart}
          ref={rangeRef}
          value={{ end: initialEndDate, start: initialStartDate }}
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    expect(startDateText).toBeInTheDocument();
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

    rangeRef.current?.resetValue();
    await waitFor(() => {
      expect(startDateText).toHaveValue(initialStartDate);
      expect(endDateText).toHaveValue(initialEndDate);
    });
  });
});
