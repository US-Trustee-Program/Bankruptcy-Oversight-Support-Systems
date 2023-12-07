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
});
