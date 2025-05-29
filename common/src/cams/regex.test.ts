import { escapeRegExCharacters } from './regex';

describe('regex', () => {
  describe('escapeRegExCharacters', () => {
    const expressions = [
      ['.', '\\.'],
      ['*', '\\*'],
      ['+', '\\+'],
      ['?', '\\?'],
      ['^', '\\^'],
      ['$', '\\$'],
      ['{', '\\{'],
      ['}', '\\}'],
      ['(', '\\('],
      [')', '\\)'],
      ['|', '\\|'],
      ['[', '\\['],
      [']', '\\]'],
      ['\\', '\\\\'],
      [
        'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o',
        'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o',
      ],
      ['normal text', 'normal text'],
    ];
    test.each(expressions)('should escape regex special character %s', (expression, expected) => {
      expect(escapeRegExCharacters(expression)).toEqual(expected);
    });
  });
});
