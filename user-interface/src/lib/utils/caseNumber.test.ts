import { copyCaseNumber, getCaseNumber } from './caseNumber';
import MockData from '@common/cams/test-utilities/mock-data';
import { copyStringToClipboard } from './clipBoard';

vi.mock('./clipBoard');

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
  const testCaseDetail = MockData.getCaseDetail();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('clicking copy button should call copyStringToClipboard with caseId', () => {
    copyCaseNumber(testCaseDetail.caseId);
    expect(copyStringToClipboard).toHaveBeenCalledWith(testCaseDetail.caseId);
  });

  test('should only call copyStringToClipboard if we have a valid case number', () => {
    copyCaseNumber('abcdefg#!@#$%');
    expect(copyStringToClipboard).not.toHaveBeenCalled();

    copyCaseNumber(testCaseDetail.caseId);
    expect(copyStringToClipboard).toHaveBeenCalledWith(testCaseDetail.caseId);
    expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
  });
});
