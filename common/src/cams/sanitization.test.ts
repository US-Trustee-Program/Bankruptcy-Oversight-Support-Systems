import { isValidUserInput } from './sanitization';

describe('Input sanitization tests', () => {
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
  test.each(testMongoQueryInjections)('should detech invalid strings', (input: string) => {
    const actual = isValidUserInput(input);
    expect(actual).toEqual(false);
  });
});
