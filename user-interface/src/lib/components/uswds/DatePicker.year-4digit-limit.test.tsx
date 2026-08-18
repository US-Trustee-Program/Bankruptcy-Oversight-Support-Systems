import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DatePicker from './DatePicker';

const DEFAULT_ID = 'test-datepicker';

function getErrorText() {
  return (document.querySelector('.date-error') as HTMLElement | null)?.textContent ?? '';
}

async function waitForValidation(ms = 600) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function renderDatePicker(props: Partial<React.ComponentProps<typeof DatePicker>> = {}) {
  render(
    <BrowserRouter>
      <DatePicker id={DEFAULT_ID} {...props} />
    </BrowserRouter>,
  );
  return screen.getByTestId(DEFAULT_ID) as HTMLInputElement;
}

describe('DatePicker — year must be 4 digits', () => {
  afterEach(() => vi.restoreAllMocks());

  test('5-digit year value shows inline year error after debounce', async () => {
    const view = renderDatePicker();

    fireEvent.change(view, { target: { value: '11111-11-11' } });

    await waitForValidation();

    expect(getErrorText()).toBe('Year must be 4 digits.');
  });

  test('5-digit year value shows inline year error on blur', async () => {
    const view = renderDatePicker();

    fireEvent.change(view, { target: { value: '11111-11-11' } });
    fireEvent.blur(view);

    expect(getErrorText()).toBe('Year must be 4 digits.');
  });

  test('normal 4-digit year does not trigger year error', async () => {
    const view = renderDatePicker();

    fireEvent.change(view, { target: { value: '2024-06-15' } });

    await waitForValidation();

    expect(getErrorText()).toBe('');
  });

  test('min-date error still fires for an in-range year but out-of-range date', async () => {
    const view = renderDatePicker({ min: '2024-01-01' });

    fireEvent.change(view, { target: { value: '2023-12-31' } });

    await waitForValidation();

    expect(getErrorText()).toContain('Must be on or after');
  });
});
