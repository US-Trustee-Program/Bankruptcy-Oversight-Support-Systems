import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker from '@/lib/components/uswds/DatePicker';

/**
 * BDD Feature: Date Picker Component
 *
 * As a user filling out a form
 * I want to select dates using a date picker
 * So that I can input dates in a consistent format
 *
 * This test suite validates the DatePicker component behavior:
 * - Date input and validation
 * - Min/max date constraints
 * - Error messaging
 * - Accessibility features
 */
describe('Feature: Date Picker Component', () => {
  /**
   * Scenario: User enters a valid date
   *
   * GIVEN a date picker is displayed
   * WHEN the user enters a valid date
   * THEN the date should be accepted without errors
   */
  test('should accept valid date input', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    // GIVEN: A date picker is rendered
    render(<DatePicker id="test-date-picker" label="Select Date" onChange={handleChange} />);

    const input = screen.getByLabelText('Select Date');

    // WHEN: User enters a valid date
    await user.type(input, '2024-06-15');

    // THEN: The onChange handler should be called
    expect(handleChange).toHaveBeenCalled();

    // AND: No error message should be displayed
    const errorDiv = document.getElementById('test-date-picker-error');
    expect(errorDiv?.textContent).toBe('');

    console.log('[TEST] ✓ Valid date accepted successfully');
  });

  /**
   * Scenario: User enters a date before minimum date
   *
   * GIVEN a date picker with a minimum date constraint
   * WHEN the user enters a date before the minimum
   * THEN an error message should be displayed
   */
  test('should show error for date before minimum', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker with minDate constraint
    render(<DatePicker id="test-date-picker" label="Select Date" minDate="2024-06-01" />);

    const input = screen.getByLabelText('Select Date');

    // WHEN: User enters a date before the minimum
    await user.type(input, '2024-05-15');

    // THEN: An error message should appear (after debounce)
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        expect(body).toContain('Date is not within allowed range');
      },
      { timeout: 1000 },
    );

    console.log('[TEST] ✓ Error displayed for date before minimum');
  });

  /**
   * Scenario: User enters a date after maximum date
   *
   * GIVEN a date picker with a maximum date constraint
   * WHEN the user enters a date after the maximum
   * THEN an error message should be displayed
   */
  test('should show error for date after maximum', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker with maxDate constraint
    render(<DatePicker id="test-date-picker" label="Select Date" maxDate="2024-12-31" />);

    const input = screen.getByLabelText('Select Date');

    // WHEN: User enters a date after the maximum
    await user.type(input, '2025-01-15');

    // THEN: An error message should appear (after debounce)
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        expect(body).toContain('Date is not within allowed range');
      },
      { timeout: 1000 },
    );

    console.log('[TEST] ✓ Error displayed for date after maximum');
  });

  /**
   * Scenario: User enters a date within valid range
   *
   * GIVEN a date picker with both min and max date constraints
   * WHEN the user enters a date within the valid range
   * THEN no error should be displayed
   */
  test('should accept date within valid range', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker with min and max constraints
    render(
      <DatePicker
        id="test-date-picker"
        label="Select Date"
        minDate="2024-01-01"
        maxDate="2024-12-31"
      />,
    );

    const input = screen.getByLabelText('Select Date');

    // WHEN: User enters a date within the range
    await user.type(input, '2024-06-15');

    // THEN: No error should be displayed
    await waitFor(
      () => {
        const errorDiv = document.querySelector('.date-error');
        expect(errorDiv?.textContent).toBe('');
      },
      { timeout: 1000 },
    );

    console.log('[TEST] ✓ Date within range accepted successfully');
  });

  /**
   * Scenario: Date picker is disabled
   *
   * GIVEN a date picker that is disabled
   * WHEN the component is rendered
   * THEN the input should be disabled
   */
  test('should render as disabled when disabled prop is true', () => {
    // GIVEN: A disabled date picker
    render(<DatePicker id="test-date-picker" label="Select Date" disabled={true} />);

    // WHEN: Component is rendered
    const input = screen.getByLabelText('Select Date');

    // THEN: Input should be disabled
    expect(input).toBeDisabled();

    console.log('[TEST] ✓ Disabled state rendered correctly');
  });

  /**
   * Scenario: Required field validation
   *
   * GIVEN a required date picker
   * WHEN the component is rendered
   * THEN the input should have required attribute
   */
  test('should mark field as required when required prop is true', () => {
    // GIVEN: A required date picker
    render(<DatePicker id="test-date-picker" label="Select Date" required={true} />);

    // WHEN: Component is rendered
    const input = screen.getByLabelText('Select Date');

    // THEN: Input should have required attribute
    expect(input).toBeRequired();

    console.log('[TEST] ✓ Required attribute set correctly');
  });

  /**
   * Scenario: Custom error message display
   *
   * GIVEN a date picker with a custom error message
   * WHEN the component is rendered
   * THEN the custom error message should be displayed
   */
  test('should display custom error message', () => {
    const customError = 'This is a custom error message';

    // GIVEN: A date picker with custom error
    render(
      <DatePicker id="test-date-picker" label="Select Date" customErrorMessage={customError} />,
    );

    // WHEN: Component is rendered
    // THEN: Custom error message should be displayed
    expect(screen.getByText(customError)).toBeInTheDocument();

    console.log('[TEST] ✓ Custom error message displayed correctly');
  });

  /**
   * Scenario: Accessibility - ARIA attributes
   *
   * GIVEN a date picker with label
   * WHEN the component is rendered
   * THEN appropriate ARIA attributes should be present
   */
  test('should have appropriate ARIA attributes', () => {
    // GIVEN: A date picker
    render(
      <DatePicker
        id="test-date-picker"
        label="Birth Date"
        minDate="1900-01-01"
        maxDate="2024-12-31"
      />,
    );

    // WHEN: Component is rendered
    const input = screen.getByLabelText('Birth Date');

    // THEN: ARIA attributes should be present
    expect(input).toHaveAttribute('aria-labelledby', 'test-date-picker-label');
    expect(input).toHaveAttribute('type', 'date');

    console.log('[TEST] ✓ ARIA attributes present and correct');
  });

  /**
   * Scenario: Clear incomplete date without error
   *
   * GIVEN a date picker
   * WHEN the user types an incomplete date
   * THEN no error should be shown
   */
  test('should not show error for incomplete date entry', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker with constraints
    render(
      <DatePicker
        id="test-date-picker"
        label="Select Date"
        minDate="2024-01-01"
        maxDate="2024-12-31"
      />,
    );

    const input = screen.getByLabelText('Select Date');

    // WHEN: User types incomplete date
    await user.type(input, '2024-06');

    // THEN: No error should be displayed (incomplete dates aren't validated)
    await waitFor(
      () => {
        const errorDiv = document.querySelector('.date-error');
        expect(errorDiv?.textContent).toBe('');
      },
      { timeout: 600 },
    );

    console.log('[TEST] ✓ No error for incomplete date entry');
  });

  /**
   * Scenario: User corrects an error by entering valid date
   *
   * GIVEN a date picker showing an error
   * WHEN the user corrects the date to a valid value
   * THEN the error should be cleared
   */
  test('should clear error when user enters valid date after error', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker with constraints
    render(
      <DatePicker
        id="test-date-picker"
        label="Select Date"
        minDate="2024-01-01"
        maxDate="2024-12-31"
      />,
    );

    const input = screen.getByLabelText('Select Date');

    // Create error: enter date before minimum
    await user.type(input, '2023-12-15');

    // Wait for error to appear
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        expect(body).toContain('Date is not within allowed range');
      },
      { timeout: 1000 },
    );

    console.log('[TEST] ✓ Error displayed');

    // WHEN: User corrects to valid date
    await user.clear(input);
    await user.type(input, '2024-06-15');

    // THEN: Error should be cleared
    await waitFor(
      () => {
        const errorDiv = document.getElementById('test-date-picker-error');
        expect(errorDiv?.textContent).toBe('');
      },
      { timeout: 1000 },
    );

    console.log('[TEST] ✓ Error cleared when valid date entered');
  });

  /**
   * Scenario: User enters invalid date like Feb 31
   *
   * GIVEN a date picker
   * WHEN the user enters an invalid date (Feb 31 doesn't exist)
   * THEN no validation error should be shown (invalid dates are ignored)
   */
  test('should not show error for impossible dates like Feb 31', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker
    render(<DatePicker id="test-date-picker" label="Select Date" />);

    const input = screen.getByLabelText('Select Date');

    // WHEN: User types Feb 31 (which doesn't exist)
    await user.type(input, '2024-02-31');

    // THEN: No error should be displayed (invalid dates are ignored)
    await waitFor(
      () => {
        const errorDiv = document.getElementById('test-date-picker-error');
        expect(errorDiv?.textContent).toBe('');
      },
      { timeout: 600 },
    );

    console.log('[TEST] ✓ Invalid date handled gracefully');
  });

  /**
   * Scenario: User enters year before 1900
   *
   * GIVEN a date picker
   * WHEN the user enters a year before 1900
   * THEN no validation error should be shown
   */
  test('should not show error for year before 1900', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker
    render(<DatePicker id="test-date-picker" label="Birth Date" />);

    const input = screen.getByLabelText('Birth Date');

    // WHEN: User enters 1850
    await user.type(input, '1850-05-15');

    // THEN: No error should be shown
    await waitFor(
      () => {
        const errorDiv = document.getElementById('test-date-picker-error');
        expect(errorDiv?.textContent).toBe('');
      },
      { timeout: 600 },
    );

    console.log('[TEST] ✓ Year before 1900 handled gracefully');
  });

  /**
   * Scenario: User enters year after 2200
   *
   * GIVEN a date picker
   * WHEN the user enters a year after 2200
   * THEN no validation error should be shown
   */
  test('should not show error for year after 2200', async () => {
    const user = userEvent.setup();

    // GIVEN: A date picker
    render(<DatePicker id="test-date-picker" label="Future Date" />);

    const input = screen.getByLabelText('Future Date');

    // WHEN: User enters 2250
    await user.type(input, '2250-12-25');

    // THEN: No error should be shown
    await waitFor(
      () => {
        const errorDiv = document.getElementById('test-date-picker-error');
        expect(errorDiv?.textContent).toBe('');
      },
      { timeout: 600 },
    );

    console.log('[TEST] ✓ Year after 2200 handled gracefully');
  });
});
