import { getCaseIdParts, isCaseClosed, isCaseOpen } from './cases';

describe('cases common functions tests', () => {
  test('should return true for re-closed case', () => {
    const closedDate = '2024-01-01';
    const reopenedDate = '2023-12-01';
    const casePartial = {
      closedDate,
      reopenedDate,
    };
    expect(isCaseClosed(casePartial)).toBe(true);
    expect(isCaseOpen(casePartial)).toBe(false);
  });

  test('should return false for reopened case', () => {
    const closedDate = '2024-01-01';
    const reopenedDate = '2024-01-02';
    const casePartial = {
      closedDate,
      reopenedDate,
    };
    expect(isCaseClosed(casePartial)).toBe(false);
    expect(isCaseOpen(casePartial)).toBe(true);
  });

  test('should return false for never closed case', () => {
    expect(isCaseClosed({})).toBe(false);
    expect(isCaseOpen({})).toBe(true);
  });

  describe('getCaseIdParts', () => {
    test('should deconstruct a case id into a division code and case number', () => {
      const caseId = '000-11-22222';
      const expected = { caseNumber: '11-22222', divisionCode: '000' };
      const actual = getCaseIdParts(caseId);
      expect(actual).toEqual(expected);
    });

    test.each(['00-11-22222', '000-1-22222', '000-11-2222', '0001122222'])(
      'should throw an error for an invalid case id: %s',
      (caseId) => {
        expect(() => getCaseIdParts(caseId)).toThrow(`Invalid case ID: ${caseId}`);
      },
    );
  });
});
