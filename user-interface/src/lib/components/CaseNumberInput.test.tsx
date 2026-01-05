import { describe } from 'vitest';
import CaseNumberInput, { formatCaseNumberValue } from './CaseNumberInput';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { InputRef } from '../type-declarations/input-fields';
import React from 'react';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('Case number input component', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('using ref, we should be able to set, get, reset, and clear value', async () => {
    const caseNumberRef = React.createRef<InputRef>();
    render(<CaseNumberInput ref={caseNumberRef} onChange={() => null} value="321cba" />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('321cba');

    await waitFor(() => {
      act(() => caseNumberRef.current?.setValue('abc123'));
      expect(input).toHaveValue('abc123');
    });

    const value1 = caseNumberRef.current?.getValue();
    expect(value1).toEqual('abc123');

    act(() => caseNumberRef.current?.resetValue());

    await waitFor(() => {
      expect(input).toHaveValue('321cba');
    });

    act(() => caseNumberRef.current?.clearValue());

    await waitFor(() => {
      expect(input).toHaveValue('');
    });

    const finalValue = caseNumberRef.current?.getValue();
    expect(finalValue).toEqual('');
  });

  test('if allowEnterKey is true and value is a valid case number and key entered is Enter key, then onChange should be called with the case number', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="12-34567" allowEnterKey={true} />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('12-34567');

    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).toHaveBeenCalledWith('12-34567');
  });

  test('if allowEnterKey is true and value is an invalid case number and key entered is Enter key, then onChange should be called with undefined', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="12-345" allowEnterKey={true} />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('12-345');

    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).toHaveBeenCalledWith(undefined);
  });

  test('if allowEnterKey is false and key entered is Enter key, then onChange should NOT be called', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="321cba" allowEnterKey={false} />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('321cba');

    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).not.toHaveBeenCalled();
  });

  test('if allowEnterKey is true and key entered is Enter key but value of input is empty string, then onChange should NOT be called', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="" allowEnterKey={true} />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('');

    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).not.toHaveBeenCalled();
  });

  test('if allowEnterKey is true and value is non-zero-length string, but key entered is NOT Enter key, then onChange should NOT be called with Enter key', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="321cba" allowEnterKey={true} />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('321cba');

    await userEvent.type(input!, 'a');
    expect(changeFunction).not.toHaveBeenCalledWith('321cba');
  });

  test('if allowPartialCaseNumber is true, onChange should be called with partial case number', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="" allowPartialCaseNumber={true} />);

    const input = document.querySelector('.usa-input');
    await userEvent.type(input!, '12');
    expect(changeFunction).toHaveBeenCalledWith('12');
  });

  test('if allowPartialCaseNumber is true and allowEnterKey is true, onChange should be called with partial case number when Enter is pressed', async () => {
    const changeFunction = vi.fn();
    render(
      <CaseNumberInput
        onChange={changeFunction}
        value="12-345"
        allowPartialCaseNumber={true}
        allowEnterKey={true}
      />,
    );

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('12-345');

    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).toHaveBeenCalledWith('12-345');
  });

  test('if allowEnterKey is true and input value is empty, handleEnter should not call onChange', async () => {
    const changeFunction = vi.fn();
    const ref = React.createRef<InputRef>();
    render(<CaseNumberInput ref={ref} onChange={changeFunction} value="" allowEnterKey={true} />);

    const input = document.querySelector('.usa-input');
    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).not.toHaveBeenCalled();
  });

  test('if onFocus is provided, it should be called when input is focused', async () => {
    const focusFunction = vi.fn();
    render(<CaseNumberInput onChange={() => null} value="" onFocus={focusFunction} />);

    const input = document.querySelector('.usa-input');
    await userEvent.click(input!);
    expect(focusFunction).toHaveBeenCalled();
  });

  test('if onFocus is not provided, focusing the input should not cause an error', async () => {
    render(<CaseNumberInput onChange={() => null} value="" />);

    const input = document.querySelector('.usa-input');
    await expect(userEvent.click(input!)).resolves.not.toThrow();
  });

  test('cursor position should be preserved when deleting a character from the middle of the input', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="" />);

    const input = document.querySelector('.usa-input') as HTMLInputElement;

    // Type "24-56789"
    await userEvent.type(input, '2456789');
    expect(input).toHaveValue('24-56789');

    // Simulate deleting the "5" by setting cursor position and firing change event
    // User has cursor at position 4 (after "24-5"), deletes "5" to get "246789"
    // After deletion, cursor should be at position 2 in the raw value "24|6789"
    input.setSelectionRange(4, 4);
    fireEvent.change(input, { target: { value: '246789', selectionStart: 2 } });

    // Wait for React to update
    await waitFor(() => {
      // After deleting "5", value should be "24-6789"
      expect(input).toHaveValue('24-6789');
    });

    // Verify cursor is at position 2 (after "24|-6789"), not at the end
    await waitFor(() => {
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });
  });

  test('cursor position should be preserved when deleting the first character', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="" />);

    const input = document.querySelector('.usa-input') as HTMLInputElement;

    // Type "24-56789"
    await userEvent.type(input, '2456789');
    expect(input).toHaveValue('24-56789');

    // Simulate deleting the first digit "2" by setting cursor at position 1 and deleting
    // User has cursor at position 1 (after "2"), deletes "2" to get "456789"
    // After deletion, cursor should be at position 0 in the raw value
    input.setSelectionRange(1, 1);
    fireEvent.change(input, { target: { value: '456789', selectionStart: 0 } });

    // Wait for React to update
    await waitFor(() => {
      // After deleting "2", value should be "45-6789"
      expect(input).toHaveValue('45-6789');
    });

    // Verify cursor is at position 0 (at the start)
    await waitFor(() => {
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(0);
    });
  });

  test('cursor position should be preserved when deleting a character right before the dash', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="" />);

    const input = document.querySelector('.usa-input') as HTMLInputElement;

    // Type "24-56789"
    await userEvent.type(input, '2456789');
    expect(input).toHaveValue('24-56789');

    // Simulate deleting "4" when cursor is at position 2 (after "24")
    // User has cursor at position 2 (after "24"), deletes "4" to get "256789"
    input.setSelectionRange(2, 2);
    fireEvent.change(input, { target: { value: '256789', selectionStart: 2 } });

    await waitFor(() => {
      // After deleting "4", value should be "25-6789"
      expect(input).toHaveValue('25-6789');
      // Cursor should be at position 2 (after "25")
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });
  });
});

describe('Test formatCaseNumberInput function', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  test('When supplied a value with a length greater than 7 digits, it should truncate value to 7 digits', async () => {
    const testValue = '1234567890';
    const resultValue = '12-34567';

    const expectedResult = {
      joinedInput: resultValue,
      isValidFullCaseNumber: true,
    };

    const returnedValue = formatCaseNumberValue(testValue);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('When supplied a value with alphabetic characters only, it should return an object with isValidFullCaseNumber false and empty string for joinedInput', async () => {
    const testValue = 'abcdefg';
    const resultValue = '';

    const expectedResult = {
      joinedInput: resultValue,
      isValidFullCaseNumber: false,
    };

    const returnedValue = formatCaseNumberValue(testValue);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('should return partial formatted input with isValidFullCaseNumber false', async () => {
    const testValue = '12345';
    const resultValue = '12-345';

    const expectedResult = {
      joinedInput: resultValue,
      isValidFullCaseNumber: false,
    };

    const returnedValue = formatCaseNumberValue(testValue);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('should return isValidFullCaseNumber false for partial input', async () => {
    const testValue = '12345';
    const resultValue = '12-345';

    const expectedResult = {
      joinedInput: resultValue,
      isValidFullCaseNumber: false,
    };

    const returnedValue = formatCaseNumberValue(testValue);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('should return isValidFullCaseNumber true for valid full case number', async () => {
    const testValue = '1234567';
    const resultValue = '12-34567';

    const expectedResult = {
      joinedInput: resultValue,
      isValidFullCaseNumber: true,
    };

    const returnedValue = formatCaseNumberValue(testValue);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('should return empty string and isValidFullCaseNumber false for empty input', async () => {
    const testValue = '';

    const expectedResult = {
      joinedInput: '',
      isValidFullCaseNumber: false,
    };

    const returnedValue = formatCaseNumberValue(testValue);
    expect(returnedValue).toEqual(expectedResult);
  });
});
