import { formatChapterType } from './chapters';

describe('formatChapterType', () => {
  test.each([
    // Known chapter mappings
    ['7-panel', '7 - Panel'],
    ['7-non-panel', '7 - Non-Panel'],
    ['11', '11'],
    ['11-subchapter-v', '11 - Subchapter V'],
    ['12', '12'],
    ['13', '13'],
    // Unknown chapters should return original value
    ['unknown', 'unknown'],
    ['7', '7'],
    ['15', '15'],
    ['', ''],
    // Case sensitivity and whitespace
    ['7-PANEL', '7-PANEL'],
    ['7-panel ', '7-panel '],
    [' 7-panel', ' 7-panel'],
    // Special characters
    ['7-panel-test', '7-panel-test'],
    ['123', '123'],
    ['11-', '11-'],
  ])('should format "%s" as "%s"', (input, expected) => {
    expect(formatChapterType(input)).toBe(expected);
  });
});
