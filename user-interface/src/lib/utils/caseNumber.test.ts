import { MockInstance } from 'vitest';
import { copyCaseNumber, getCaseNumber } from './caseNumber';
import MockData from '@common/cams/test-utilities/mock-data';
import { waitFor } from '@testing-library/react';

describe('Formatting case id', () => {
  test('Should get case number from case id', async () => {
    const caseId = '081-11-22222';
    const caseNumber = '11-22222';

    const actual = getCaseNumber(caseId);
    expect(actual).toEqual(caseNumber);
  });

  test('Should get case number from case id when the division is not present', async () => {
    const caseId = '11-22222';
    const caseNumber = '11-22222';

    const actual = getCaseNumber(caseId);
    expect(actual).toEqual(caseNumber);
  });

  test('Should handle undefined input', async () => {
    const actual = getCaseNumber(undefined);
    expect(actual).toEqual('');
  });
});
describe('Testing the clipboard with caseId', () => {
  let writeTextMock: MockInstance<(data: string) => Promise<void>> = vi.fn().mockResolvedValue('');
  const testCaseDetail = MockData.getCaseDetail();
  beforeEach(() => {
    if (!navigator.clipboard) {
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });
    } else {
      writeTextMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    }
  });

  test('clicking copy button should write caseId to clipboard', async () => {
    copyCaseNumber(testCaseDetail.caseId);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(testCaseDetail.caseId);
    });
  });

  test('should only copy to clipboard if we have a valid case number', async () => {
    copyCaseNumber('abcdefg#!@#$%');
    expect(writeTextMock).not.toHaveBeenCalled();

    copyCaseNumber(testCaseDetail.caseId);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(testCaseDetail.caseId);
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
  });
});
