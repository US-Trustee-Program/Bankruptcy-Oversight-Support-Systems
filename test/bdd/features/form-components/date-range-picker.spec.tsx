import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DateRangePicker from '@/lib/components/uswds/DateRangePicker';

/**
 * BDD Feature: Date Range Picker Component
 *
 * As a user selecting a date range
 * I want to choose start and end dates with validation
 * So that I can specify valid date ranges for my search or filter
 *
 * This test suite validates the DateRangePicker component behavior:
 * - Start and end date selection
 * - Date range validation (start must be before end)
 * - Min/max date constraints for both dates
 * - Error messaging for invalid ranges
 * - Accessibility features
 */
describe('Feature: Date Range Picker Component', () => {
  /**
   * Scenario: User enters valid date range
   *
   * GIVEN a date range picker is displayed
   * WHEN the user enters a valid start and end date
   * THEN both dates should be accepted without errors
   */
  test('should accept valid date range', async () => {
    const user = userEvent.setup();
    const handleStartChange = vi.fn();
    const handleEndChange = vi.fn();

    // GIVEN: A date range picker is rendered
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        onStartDateChange={handleStartChange}
        onEndDateChange={handleEndChange}
      />,
    );

    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    // WHEN: User enters valid start and end dates
    await user.type(startInput, '2024-06-01');
    await user.type(endInput, '2024-06-30');

    // THEN: Both onChange handlers should be called
    expect(handleStartChange).toHaveBeenCalled();
    expect(handleEndChange).toHaveBeenCalled();

    // AND: No error messages should be displayed
    const body = document.body.textContent || '';
    expect(body).not.toContain('Start date cannot be after end date');

    console.log('[TEST] ✓ Valid date range accepted successfully');
  });

  /**
   * Scenario: User enters start date after end date
   *
   * GIVEN a date range picker with both dates filled
   * WHEN the start date is after the end date
   * THEN an error message should be displayed
   */
  test('should show error when start date is after end date', async () => {
    const user = userEvent.setup();

    // GIVEN: A date range picker
    render(
      <DateRangePicker id="test-date-range" startDateLabel="Start Date" endDateLabel="End Date" />,
    );

    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    // WHEN: User enters start date after end date
    await user.type(endInput, '2024-06-01');
    await user.type(startInput, '2024-06-30');

    // Trigger blur to validate
    await user.tab();

    // THEN: Error message should appear
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body).toContain('Start date cannot be after end date');
    });

    console.log('[TEST] ✓ Error displayed when start date is after end date');
  });

  /**
   * Scenario: User corrects invalid date range
   *
   * GIVEN a date range picker with an error
   * WHEN the user corrects the date range
   * THEN the error should be cleared
   */
  test('should clear error when date range is corrected', async () => {
    const user = userEvent.setup();

    // GIVEN: A date range picker
    render(
      <DateRangePicker id="test-date-range" startDateLabel="Start Date" endDateLabel="End Date" />,
    );

    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    // WHEN: User first enters invalid range
    await user.type(endInput, '2024-06-01');
    await user.type(startInput, '2024-06-30');
    await user.tab();

    // Verify error appears
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body).toContain('Start date cannot be after end date');
    });

    // AND: User corrects the start date
    await user.clear(startInput);
    await user.type(startInput, '2024-05-15');
    await user.tab();

    // THEN: Error should be cleared
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body).not.toContain('Start date cannot be after end date');
    });

    console.log('[TEST] ✓ Error cleared when date range corrected');
  });

  /**
   * Scenario: Date range picker with min/max constraints
   *
   * GIVEN a date range picker with min and max date constraints
   * WHEN the component is rendered
   * THEN both date pickers should respect the constraints
   */
  test('should apply min/max constraints to both date pickers', async () => {
    userEvent.setup();

    // GIVEN: A date range picker with constraints
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        minDate="2024-01-01"
        maxDate="2024-12-31"
      />,
    );

    const startInput = screen.getByLabelText('Start Date') as HTMLInputElement;
    const endInput = screen.getByLabelText('End Date') as HTMLInputElement;

    // THEN: Both inputs should have min and max attributes
    expect(startInput.min).toBe('2024-01-01');
    expect(startInput.max).toBe('2024-12-31');
    expect(endInput.min).toBe('2024-01-01');
    expect(endInput.max).toBe('2024-12-31');

    console.log('[TEST] ✓ Min/max constraints applied to both date pickers');
  });

  /**
   * Scenario: Date range picker displays both labels
   *
   * GIVEN a date range picker with custom labels
   * WHEN the component is rendered
   * THEN both custom labels should be displayed
   */
  test('should display custom labels for start and end dates', () => {
    // GIVEN: A date range picker with custom labels
    render(
      <DateRangePicker id="test-date-range" startDateLabel="From Date" endDateLabel="To Date" />,
    );

    // THEN: Both labels should be present
    expect(screen.getByLabelText('From Date')).toBeInTheDocument();
    expect(screen.getByLabelText('To Date')).toBeInTheDocument();

    console.log('[TEST] ✓ Custom labels displayed correctly');
  });

  /**
   * Scenario: Date range picker uses default labels
   *
   * GIVEN a date range picker without custom labels
   * WHEN the component is rendered
   * THEN default labels should be used
   */
  test('should use default labels when not specified', () => {
    // GIVEN: A date range picker without custom labels
    render(<DateRangePicker id="test-date-range" />);

    // THEN: Default labels should be present
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();

    console.log('[TEST] ✓ Default labels displayed correctly');
  });

  /**
   * Scenario: Disabled date range picker
   *
   * GIVEN a date range picker that is disabled
   * WHEN the component is rendered
   * THEN both inputs should be disabled
   */
  test('should disable both inputs when disabled prop is true', () => {
    // GIVEN: A disabled date range picker
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        disabled={true}
      />,
    );

    // THEN: Both inputs should be disabled
    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    expect(startInput).toBeDisabled();
    expect(endInput).toBeDisabled();

    console.log('[TEST] ✓ Both inputs disabled correctly');
  });

  /**
   * Scenario: Required date range fields
   *
   * GIVEN a date range picker marked as required
   * WHEN the component is rendered
   * THEN both inputs should have required attribute
   */
  test('should mark both fields as required when required prop is true', () => {
    // GIVEN: A required date range picker
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        required={true}
      />,
    );

    // THEN: Both inputs should be required
    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    expect(startInput).toBeRequired();
    expect(endInput).toBeRequired();

    console.log('[TEST] ✓ Both fields marked as required');
  });

  /**
   * Scenario: Accessibility - Hidden hints for screen readers
   *
   * GIVEN a date range picker with constraints
   * WHEN the component is rendered
   * THEN accessible hints should be present for screen readers
   */
  test('should provide accessible hints for screen readers', () => {
    // GIVEN: A date range picker with min/max constraints
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        minDate="2024-01-01"
        maxDate="2024-12-31"
      />,
    );

    // THEN: Hidden hint elements should exist
    const startHint = document.getElementById('test-date-range-start-hint');
    const endHint = document.getElementById('test-date-range-end-hint');
    const ariaDescription = document.getElementById('test-date-range-aria-description');

    expect(startHint).toBeInTheDocument();
    expect(endHint).toBeInTheDocument();
    expect(ariaDescription).toBeInTheDocument();

    // AND: Hints should contain date range information
    expect(startHint?.textContent).toContain('Valid dates are between 2024-01-01 and 2024-12-31');

    console.log('[TEST] ✓ Accessible hints present for screen readers');
  });

  /**
   * Scenario: Controlled component with initial values
   *
   * GIVEN a date range picker with initial values
   * WHEN the component is rendered
   * THEN both inputs should display the initial values
   */
  test('should display initial values when provided', () => {
    // GIVEN: A date range picker with initial values
    const initialRange = {
      start: '2024-06-01',
      end: '2024-06-30',
    };

    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        value={initialRange}
      />,
    );

    // THEN: Both inputs should display initial values
    const startInput = screen.getByLabelText('Start Date') as HTMLInputElement;
    const endInput = screen.getByLabelText('End Date') as HTMLInputElement;

    expect(startInput.value).toBe('2024-06-01');
    expect(endInput.value).toBe('2024-06-30');

    console.log('[TEST] ✓ Initial values displayed correctly');
  });

  /**
   * Scenario: Validating only complete dates
   *
   * GIVEN a date range picker
   * WHEN user types incomplete dates
   * THEN validation should not trigger until dates are complete
   */
  test('should not validate incomplete dates', async () => {
    const user = userEvent.setup();

    // GIVEN: A date range picker
    render(
      <DateRangePicker id="test-date-range" startDateLabel="Start Date" endDateLabel="End Date" />,
    );

    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    // WHEN: User types incomplete dates
    await user.type(startInput, '2024-06');
    await user.type(endInput, '2024-05');
    await user.tab();

    // THEN: No error should be displayed (incomplete dates aren't validated)
    const body = document.body.textContent || '';
    expect(body).not.toContain('Start date cannot be after end date');

    console.log('[TEST] ✓ Incomplete dates not validated');
  });

  /**
   * Scenario: Error clears when user starts typing
   *
   * GIVEN a date range picker with a validation error
   * WHEN the user starts typing in either field
   * THEN the error should be cleared immediately
   */
  test('should clear error when user starts typing', async () => {
    const user = userEvent.setup();

    // GIVEN: A date range picker with an error
    render(
      <DateRangePicker id="test-date-range" startDateLabel="Start Date" endDateLabel="End Date" />,
    );

    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    // Create an error state
    await user.type(endInput, '2024-06-01');
    await user.type(startInput, '2024-06-30');
    await user.tab();

    // Verify error appears
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body).toContain('Start date cannot be after end date');
    });

    // WHEN: User starts typing in start field (clear and re-enter a new date)
    await user.clear(startInput);

    // THEN: Error should be cleared immediately after clearing
    await waitFor(() => {
      const body = document.body.textContent || '';
      expect(body).not.toContain('Start date cannot be after end date');
    });

    console.log('[TEST] ✓ Error cleared when user starts typing');
  });

  /**
   * Scenario: Accessible date range constraint description
   *
   * GIVEN a date range picker with only minDate
   * WHEN the component is rendered
   * THEN appropriate constraint description should be generated
   */
  test('should generate correct constraint description for minDate only', () => {
    // GIVEN: A date range picker with only minDate
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        minDate="2024-01-01"
      />,
    );

    // THEN: Hint should contain correct constraint description
    const startHint = document.getElementById('test-date-range-start-hint');
    expect(startHint?.textContent).toContain('Valid dates are on or after 2024-01-01');

    console.log('[TEST] ✓ MinDate constraint description generated correctly');
  });

  /**
   * Scenario: Accessible date range constraint description
   *
   * GIVEN a date range picker with only maxDate
   * WHEN the component is rendered
   * THEN appropriate constraint description should be generated
   */
  test('should generate correct constraint description for maxDate only', () => {
    // GIVEN: A date range picker with only maxDate
    render(
      <DateRangePicker
        id="test-date-range"
        startDateLabel="Start Date"
        endDateLabel="End Date"
        maxDate="2024-12-31"
      />,
    );

    // THEN: Hint should contain correct constraint description
    const startHint = document.getElementById('test-date-range-start-hint');
    expect(startHint?.textContent).toContain('Valid dates are on or before 2024-12-31');

    console.log('[TEST] ✓ MaxDate constraint description generated correctly');
  });
});
