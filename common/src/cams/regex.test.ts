import { escapeRegExCharacters, normalizeWebsiteUrl, WEBSITE_RELAXED_REGEX } from './regex';

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

  describe('normalizeWebsiteUrl', () => {
    test('should add https:// to URLs without protocol', () => {
      expect(normalizeWebsiteUrl('www.example.com')).toBe('https://www.example.com');
      expect(normalizeWebsiteUrl('example.com')).toBe('https://example.com');
      expect(normalizeWebsiteUrl('subdomain.example.com/path')).toBe(
        'https://subdomain.example.com/path',
      );
    });

    test('should preserve URLs that already have protocol', () => {
      expect(normalizeWebsiteUrl('https://www.example.com')).toBe('https://www.example.com');
      expect(normalizeWebsiteUrl('http://example.com')).toBe('http://example.com');
      expect(normalizeWebsiteUrl('https://example.com/path?query=1')).toBe(
        'https://example.com/path?query=1',
      );
    });

    test('should handle empty or invalid inputs', () => {
      expect(normalizeWebsiteUrl('')).toBe('');
      expect(normalizeWebsiteUrl('   ')).toBe('');
      expect(normalizeWebsiteUrl(undefined)).toBe('');
      expect(normalizeWebsiteUrl(null as unknown as string)).toBe('');
    });

    test('should trim whitespace', () => {
      expect(normalizeWebsiteUrl('  www.example.com  ')).toBe('https://www.example.com');
      expect(normalizeWebsiteUrl('  https://example.com  ')).toBe('https://example.com');
    });

    test('should return empty string for unsupported protocols', () => {
      expect(normalizeWebsiteUrl('ftp://example.com')).toBe('');
      expect(normalizeWebsiteUrl('mailto:test@example.com')).toBe('');
      expect(normalizeWebsiteUrl('file://localfile.txt')).toBe('');
      expect(normalizeWebsiteUrl('ssh://server.com')).toBe('');
      expect(normalizeWebsiteUrl('telnet://server.com')).toBe('');
    });

    test('should return empty string for URLs with embedded protocols', () => {
      // These are malformed URLs that could bypass security checks
      expect(normalizeWebsiteUrl('http://mailto:foobar')).toBe('');
      expect(normalizeWebsiteUrl('http://ftp://embedded-protocol.com')).toBe('');
      expect(normalizeWebsiteUrl('https://ftp://badsite.com')).toBe('');
      expect(normalizeWebsiteUrl('http://file://localfile.txt')).toBe('');
      expect(normalizeWebsiteUrl('https://ssh://server.com')).toBe('');
    });
  });

  describe('WEBSITE_RELAXED_REGEX', () => {
    test('should match URLs with protocol', () => {
      const validUrlsWithProtocol = [
        'https://www.example.com',
        'http://example.org',
        'https://subdomain.example.com/path',
        'https://example.com/path?query=1#section',
      ];

      validUrlsWithProtocol.forEach((url) => {
        expect(WEBSITE_RELAXED_REGEX.test(url)).toBe(true);
      });
    });

    test('should match URLs without protocol', () => {
      const validUrlsWithoutProtocol = [
        'www.example.com',
        'example.org',
        'subdomain.example.com/path',
        'example.com/path?query=1#section',
        'trustee-website.com',
        'jane-smith-trustee.com',
      ];

      validUrlsWithoutProtocol.forEach((url) => {
        expect(WEBSITE_RELAXED_REGEX.test(url)).toBe(true);
      });
    });

    test('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'just-text',
        'ftp://invalid-protocol.com',
        'https://',
        '',
        'missing-tld',
      ];

      invalidUrls.forEach((url) => {
        expect(WEBSITE_RELAXED_REGEX.test(url)).toBe(false);
      });
    });
  });
});
