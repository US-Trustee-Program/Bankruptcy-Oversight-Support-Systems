import { cleanZeroWidthSpaces } from './richTextEditorUtilities';

const ZERO_WIDTH_SPACE = '\u200B';

describe('cleanZeroWidthSpaces', () => {
  it('removes zero-width spaces from a string containing only zero-width spaces', () => {
    // Arrange
    const input = `${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}`;

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('');
  });

  it('removes zero-width spaces from a string with mixed content', () => {
    // Arrange
    const input = `Hello${ZERO_WIDTH_SPACE}World${ZERO_WIDTH_SPACE}!`;

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('HelloWorld!');
  });

  it('returns the same string if there are no zero-width spaces', () => {
    // Arrange
    const input = 'Just a normal string.';

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('Just a normal string.');
  });

  it('removes zero-width spaces at the start and end of the string', () => {
    // Arrange
    const input = `${ZERO_WIDTH_SPACE}Start and end${ZERO_WIDTH_SPACE}`;

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('Start and end');
  });

  it('removes interleaved zero-width spaces', () => {
    // Arrange
    const input = `A${ZERO_WIDTH_SPACE}B${ZERO_WIDTH_SPACE}C`;

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('ABC');
  });

  it('returns an empty string when input is empty', () => {
    // Arrange
    const input = '';

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('');
  });

  it('handles a string with only whitespace and zero-width spaces', () => {
    // Arrange
    const input = `   ${ZERO_WIDTH_SPACE}   ${ZERO_WIDTH_SPACE}`;

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('      ');
  });

  it('does not remove similar but not identical unicode characters', () => {
    // Arrange
    const input = `A\u200CA`; // \u200C is ZERO WIDTH NON-JOINER, not ZERO WIDTH SPACE

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe(`A\u200CA`);
  });

  it('handles a very long string with many zero-width spaces', () => {
    // Arrange
    const input = Array(1000).fill(`word${ZERO_WIDTH_SPACE}`).join('');

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe(Array(1000).fill('word').join(''));
  });

  it('does not throw if input is an empty string', () => {
    // Arrange
    const input = '';

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('');
  });

  it('removes consecutive zero-width spaces', () => {
    // Arrange
    const input = `foo${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}bar`;

    // Act
    const result = cleanZeroWidthSpaces(input);

    // Assert
    expect(result).toBe('foobar');
  });
});
