import { ACTIVE_STATUS_CODES, CHAPTER_ACTIVE_STATUS_CODES } from './ats.constants';

// Literal lists on purpose, although the source derives them: adding or removing a code changes
// which trustees the trustee data report lists as "in TOD only" and which trustees the migration
// loads by default, so such a change must be deliberate.
describe('ATS active status codes', () => {
  test('should be exactly these codes on every chapter', () => {
    expect([...ACTIVE_STATUS_CODES].sort()).toEqual([
      '1',
      '12',
      '8',
      'C',
      'E',
      'O',
      'P',
      'PA',
      'S',
      'V',
    ]);
  });

  test('should be exactly these extra codes on each case-by-case chapter', () => {
    expect(
      Object.fromEntries(
        Object.entries(CHAPTER_ACTIVE_STATUS_CODES).map(([chapter, codes]) => [
          chapter,
          [...codes].sort(),
        ]),
      ),
    ).toEqual({ '12CBC': ['2'], '13CBC': [] });
  });
});
