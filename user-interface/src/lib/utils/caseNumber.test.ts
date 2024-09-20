import { MockInstance } from 'vitest';
import { copyCaseNumber, getCaseNumber } from './caseNumber';
import MockData from '@common/cams/test-utilities/mock-data';

describe('Formatting case id', () => {
  it('Should get case number from case id', async () => {
    const caseId = '081-11-22222';
    const caseNumber = '11-22222';

    const actual = getCaseNumber(caseId);
    expect(actual).toEqual(caseNumber);
  });

  it('Should get case number from case id when the division is not present', async () => {
    const caseId = '11-22222';
    const caseNumber = '11-22222';

    const actual = getCaseNumber(caseId);
    expect(actual).toEqual(caseNumber);
  });

  it('Should handle undefined input', async () => {
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
    expect(writeTextMock).toHaveBeenCalledWith(testCaseDetail.caseId);
  });

  test('should only copy to clipboard if we have a valid case number', () => {
    copyCaseNumber('abcdefg#!@#$%');
    expect(writeTextMock).not.toHaveBeenCalled();

    copyCaseNumber(testCaseDetail.caseId);
    expect(writeTextMock).toHaveBeenCalledWith(testCaseDetail.caseId);
    expect(writeTextMock).toHaveBeenCalledTimes(1);
  });
});
