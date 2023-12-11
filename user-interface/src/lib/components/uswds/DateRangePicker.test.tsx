import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import DateRangePicker from './DateRangePicker';

describe('Test DateRangePicker component', async () => {
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
    expect(startDateText).toBeInTheDocument();
    act(() => {
      fireEvent.change(startDateText, { target: { value: '2020-01-01' } });
    });
    expect(mockHandlerStart).toHaveBeenCalled();

    const endDateText = screen.getByTestId('date-picker-date-end');
    expect(endDateText).toBeInTheDocument();
    act(() => {
      fireEvent.change(endDateText, { target: { value: '2020-01-01' } });
    });
    expect(mockHandlerEnd).toHaveBeenCalled();
  });

  test('should set min and max attributes when minDate and maxDate is supplied', async () => {
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          minDate="01/01/2024"
          maxDate="01/01/2025"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    const startDateText = screen.getByTestId('date-picker-date-start');
    expect(startDateText).toBeInTheDocument();
    expect(startDateText).toHaveAttribute('min', '01/01/2024');
    expect(startDateText).toHaveAttribute('max', '01/01/2025');

    const endDateText = screen.getByTestId('date-picker-date-end');
    expect(endDateText).toBeInTheDocument();
    expect(endDateText).toHaveAttribute('min', '01/01/2024');
    expect(endDateText).toHaveAttribute('max', '01/01/2025');
  });

  test('should adjust min and max attributes when start or end date is changed, and reset when cleared', async () => {
    render(
      <React.StrictMode>
        <DateRangePicker
          id={'date-picker'}
          minDate="01/01/2020"
          maxDate="01/01/2035"
        ></DateRangePicker>
      </React.StrictMode>,
    );

    let startDateText = screen.getByTestId('date-picker-date-start');
    let endDateText = screen.getByTestId('date-picker-date-end');
    expect(startDateText).toBeInTheDocument();
    expect(startDateText).toHaveAttribute('max', '01/01/2035');
    expect(endDateText).toHaveAttribute('min', '01/01/2020');

    act(() => {
      fireEvent.change(startDateText, { target: { value: '2022-05-01' } });
    });

    startDateText = screen.getByTestId('date-picker-date-start');
    endDateText = screen.getByTestId('date-picker-date-end');
    expect(startDateText).toHaveAttribute('max', '01/01/2035');
    expect(endDateText).toHaveAttribute('min', '2022-05-01');

    act(() => {
      fireEvent.change(endDateText, { target: { value: '2025-07-01' } });
    });

    startDateText = screen.getByTestId('date-picker-date-start');
    endDateText = screen.getByTestId('date-picker-date-end');
    expect(startDateText).toHaveAttribute('max', '2025-07-01');
    expect(endDateText).toHaveAttribute('min', '2022-05-01');

    act(() => {
      fireEvent.change(startDateText, { target: { value: '' } });
    });

    expect(startDateText).toHaveAttribute('max', '2025-07-01');
    expect(endDateText).toHaveAttribute('min', '01/01/2020');

    act(() => {
      fireEvent.change(endDateText, { target: { value: '' } });
    });

    expect(startDateText).toHaveAttribute('max', '01/01/2035');
    expect(endDateText).toHaveAttribute('min', '01/01/2020');
  });
});
