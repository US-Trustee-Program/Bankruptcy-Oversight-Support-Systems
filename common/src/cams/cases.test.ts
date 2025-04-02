import { isCaseClosed, isCaseOpen } from './cases';

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
});
