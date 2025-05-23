import { maskToExtendedAscii, isValidUserInput, filterToExtendedAscii } from './sanitization';

describe('String sanitization functions', () => {
  describe('isValidInput', () => {
    const validInputs = [
      ["Let's remove this item."],
      ['We need to find a better way.'],
      ['This is a safe string.'],
      ["Let's fetch some data."],
      ['This is just a plain sentence.'],
      ['If you have nothing better to do, Count (or Prince), something--something.'],
    ];
    test.each(validInputs)('should pass notes through', (input: string) => {
      const actual = isValidUserInput(input);
      expect(actual).toEqual(true);
    });

    const testXSSNotes = [
      ['<script></script>'],
      ['<script>foo</script>'],
      ["fetch('/api/data');"],
      ["eval('/api/data');"],
      ["document.querySelector('#id');"],
      ["<script>alert('XSS');</script>"],
    ];
    test.each(testXSSNotes)('should detect invalid strings', (input: string) => {
      const actual = isValidUserInput(input);
      expect(actual).toEqual(false);
    });

    const testMongoQueryInjections = [['$and()'], ["$eq:{'this should fail'}"], ['$not:{}']];
    test.each(testMongoQueryInjections)('should detect invalid strings', (input: string) => {
      const actual = isValidUserInput(input);
      expect(actual).toEqual(false);
    });
  });

  describe('maskToExtendedAscii', () => {
    const testStrings = [
      ['Hello World', 'Hello World', undefined],
      ['Bell' + String.fromCharCode(0x07), 'Bell', undefined],
      ['Café', 'Café', undefined],
      ['Hello 世界', 'Hello ', undefined],
      ['Hello 世界 2', 'Hello .. 2', '.'],
      [String.fromCharCode(0x2764) + ' Emoji Test', ' Emoji Test', undefined],
      ['❤️ Emoji Test 2', 'xx Emoji Test 2', 'x'],
      ['Oh 💩 Test', 'Oh X Test', 'X'],
    ];

    test.each(testStrings)(
      'should filter %s',
      (dirty: string, expected: string, replacement?: string) => {
        expect(maskToExtendedAscii(dirty, replacement ?? '')).toEqual(expected);
      },
    );
  });

  describe('filterToExtendedAscii', () => {
    const testStrings = [
      ['Hello World', 'Hello World'],
      ['Bell' + String.fromCharCode(0x07), 'Bell'],
      ['Test Del ' + String.fromCharCode(0x7f) + ' char', 'Test Del  char'],
      ['Café', 'Café'],
      ['Hello 世界', 'Hello '],
      ['Héllo 👋 ñäçø — 你好 ×÷', 'Héllo  ñäçø   '],
      [String.fromCharCode(0x2764) + ' Emoji Test', ' Emoji Test'],
    ];

    test.each(testStrings)('should filter %s', (dirty: string, expected: string) => {
      expect(filterToExtendedAscii(dirty)).toEqual(expected);
    });
  });
});
