import { describe } from 'vitest';
import CaseNumberInput, { validateCaseNumberInput } from './CaseNumberInput';
import { act, render, waitFor } from '@testing-library/react';
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

  test('if allowEnterKey is true and value is a non-zero-length string and key entered is Enter key, then onChange should be called', async () => {
    const changeFunction = vi.fn();
    render(<CaseNumberInput onChange={changeFunction} value="321cba" allowEnterKey={true} />);

    const input = document.querySelector('.usa-input');
    expect(input).toHaveValue('321cba');

    await userEvent.type(input!, '{Enter}');
    expect(changeFunction).toHaveBeenCalled();
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
});

describe('Test validateCaseNumberInput function', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  test('When supplied a value with a length greater than 7 digits, it should truncate value to 7 digits', async () => {
    const testValue = '1234567890';
    const resultValue = '12-34567';

    const expectedResult = {
      caseNumber: resultValue,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateCaseNumberInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('When supplied a value with alphabetic characters only, it should return an object with undefined caseNumber and empty string for joinedInput', async () => {
    const testValue = 'abcdefg';
    const resultValue = '';

    const expectedResult = {
      caseNumber: undefined,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateCaseNumberInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    expect(returnedValue).toEqual(expectedResult);
  });
});
