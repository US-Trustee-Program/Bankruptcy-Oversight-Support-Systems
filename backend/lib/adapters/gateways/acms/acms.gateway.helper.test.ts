import { normalizeAcmsCaseChapter } from './acms.gateway.helper';

describe('ACMS Gateway Helper Tests', () => {
  describe('normalizeAcmsCaseChapter', () => {
    test.each(['7A', '7N'])("normalizes '%s' to '7'", (rawChapter) => {
      expect(normalizeAcmsCaseChapter(rawChapter)).toBe('7');
    });

    test("normalizes '09' to '9'", () => {
      expect(normalizeAcmsCaseChapter('09')).toBe('9');
    });

    test.each(['7', '9', '11', '12', '13', '15'])(
      "passes valid chapter '%s' through unchanged",
      (chapter) => {
        expect(normalizeAcmsCaseChapter(chapter)).toBe(chapter);
      },
    );

    test('trims whitespace', () => {
      expect(normalizeAcmsCaseChapter(' 7 ')).toBe('7');
    });

    test("throws for unrecognized chapter 'AC'", () => {
      expect(() => normalizeAcmsCaseChapter('AC')).toThrow('Invalid ACMS chapter value: AC');
    });

    test('throws for an empty string', () => {
      expect(() => normalizeAcmsCaseChapter('')).toThrow('Invalid ACMS chapter value:');
    });
  });
});
