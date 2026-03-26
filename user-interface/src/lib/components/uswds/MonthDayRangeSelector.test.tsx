import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import MonthDayRangeSelector from './MonthDayRangeSelector';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

function renderComponent(
  overrides: Partial<React.ComponentProps<typeof MonthDayRangeSelector>> = {},
) {
  const componentProps = {
    id: 'test-range',
    label: 'Test Period',
    startValue: '',
    endValue: '',
    onStartChange: vi.fn(),
    onEndChange: vi.fn(),
    ...overrides,
  };
  const { container } = render(
    <div>
      <MonthDayRangeSelector {...componentProps} />
      <button data-testid="outside-button">Outside</button>
    </div>,
  );
  return { componentProps, container };
}

describe('MonthDayRangeSelector layout', () => {
  test('renders the start and end selectors', () => {
    renderComponent();
    expect(document.getElementById('test-range-start-month')).toBeInTheDocument();
    expect(document.getElementById('test-range-start-day')).toBeInTheDocument();
    expect(document.getElementById('test-range-end-month')).toBeInTheDocument();
    expect(document.getElementById('test-range-end-day')).toBeInTheDocument();
  });

  test('renders a separator icon between the two selectors', () => {
    renderComponent();
    const separator = document.querySelector('.review-period-separator');
    expect(separator).toBeInTheDocument();
    const icon = separator!.querySelector('[data-testid="icon"]');
    expect(icon).toBeInTheDocument();
    expect(icon!.querySelector('use')!.getAttribute('xlink:href')).toBe(
      '/assets/styles/img/sprite.svg#remove',
    );
  });
});

describe('MonthDayRangeSelector clear button', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('does not render clear button when both values are empty', () => {
    renderComponent({ startValue: '', endValue: '' });
    expect(screen.queryByRole('button', { name: 'Clear Test Period' })).not.toBeInTheDocument();
  });

  test('renders clear button when startValue is set', () => {
    renderComponent({ startValue: '1900-04-01' });
    expect(screen.getByRole('button', { name: 'Clear Test Period' })).toBeInTheDocument();
  });

  test('renders clear button when endValue is set', () => {
    renderComponent({ endValue: '1900-03-31' });
    expect(screen.getByRole('button', { name: 'Clear Test Period' })).toBeInTheDocument();
  });

  test('renders clear button when both values are set', () => {
    renderComponent({ startValue: '1900-04-01', endValue: '1900-03-31' });
    expect(screen.getByRole('button', { name: 'Clear Test Period' })).toBeInTheDocument();
  });

  test('clicking clear button calls onStartChange and onEndChange with empty string', async () => {
    const { componentProps } = renderComponent({
      startValue: '1900-04-01',
      endValue: '1900-03-31',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear Test Period' }));

    expect(componentProps.onStartChange).toHaveBeenCalledWith('');
    expect(componentProps.onEndChange).toHaveBeenCalledWith('');
  });
});

describe('MonthDayRangeSelector validation', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('shows partial date error when only month is selected and submitted is true', () => {
    renderComponent({ startValue: '1900-04-', submitted: true });
    expect(screen.getByText('Must be a valid date mm/dd.')).toBeInTheDocument();
  });

  test('does not show partial date error when only month is selected and submitted is false', () => {
    renderComponent({ startValue: '1900-04-', submitted: false });
    expect(screen.queryByText('Must be a valid date mm/dd.')).not.toBeInTheDocument();
  });

  test('shows "End date is required." after interaction and blur when start is set and end is empty', async () => {
    renderComponent({ startValue: '1900-04-01', endValue: '' });

    // Focus into the group, then focus the sibling button outside to trigger blur
    await userEvent.click(document.getElementById('test-range-start-month')!);
    await userEvent.click(screen.getByTestId('outside-button'));

    expect(screen.getByText('End date is required.')).toBeInTheDocument();
  });

  test('does not show error while the group is focused', async () => {
    renderComponent({ startValue: '1900-04-01', endValue: '' });

    await userEvent.click(document.getElementById('test-range-start-month')!);

    // Still focused — no error yet
    expect(screen.queryByText('End date is required.')).not.toBeInTheDocument();
  });

  test('does not show error before any interaction', () => {
    renderComponent({ startValue: '1900-04-01', endValue: '' });
    expect(screen.queryByText('End date is required.')).not.toBeInTheDocument();
  });

  test('calls onValidationChange(false) when start is set without end', () => {
    const onValidationChange = vi.fn();
    renderComponent({ startValue: '1900-04-01', endValue: '', onValidationChange });
    expect(onValidationChange).toHaveBeenCalledWith(false);
  });

  test('calls onValidationChange(true) when both values are valid', () => {
    const onValidationChange = vi.fn();
    renderComponent({ startValue: '1900-04-01', endValue: '1900-03-31', onValidationChange });
    expect(onValidationChange).toHaveBeenCalledWith(true);
  });

  test('calls onValidationChange(true) when both values are empty', () => {
    const onValidationChange = vi.fn();
    renderComponent({ startValue: '', endValue: '', onValidationChange });
    expect(onValidationChange).toHaveBeenCalledWith(true);
  });

  test('shows externalError instead of internal error', async () => {
    renderComponent({
      startValue: '1900-04-01',
      endValue: '',
      externalError: 'TPR Review Period End is required.',
      submitted: true,
    });
    expect(screen.getByText('TPR Review Period End is required.')).toBeInTheDocument();
  });

  test('applies error styling to child selectors when there is an error', () => {
    renderComponent({ startValue: '1900-04-01', endValue: '', submitted: true });
    expect(document.getElementById('test-range-start-month')).toHaveClass('usa-input--error');
    expect(document.getElementById('test-range-end-month')).toHaveClass('usa-input--error');
  });
});
