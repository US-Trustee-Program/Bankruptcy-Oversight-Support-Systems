import { isValidUserInput } from './sanitization';

describe('Input sanitization tests', () => {
  const validInputs = [
    ["Let's remove this item."],
    ['We need to find a better way.'],
    ['This is a safe string.'],
    ["Let's fetch some data."],
    ['This is just a plain sentence.'],
  ];
  test.each(validInputs)('should pass notes through', (input: string) => {
    const actual = isValidUserInput(input);
    expect(actual).toEqual(true);
  });

  const testXSSNotes = [
    ['<script></script>'],
    ['<script>foo</script>'],
    ["<script>alert('XSS');</script>"],
    ['Use setTimeout(() => {}, 1000);'],
    ["document.querySelector('#id');"],
    ["fetch('/api/data');"],
  ];
  test.each(testXSSNotes)('should detech invalid strings', (input: string) => {
    const actual = isValidUserInput(input);
    expect(actual).toEqual(false);
  });
});
