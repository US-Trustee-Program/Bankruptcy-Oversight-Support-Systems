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
        'http://very-long-subdomain.another-subdomain.example.com',
        'https://example.com/very/deep/path/structure',
        'http://example.com:8080',
        'https://example.com/path?multiple=1&params=true',
        'https://example.com/path#multiple-sections',
        'https://sub-domain-with-dashes.example.com',
        'https://example.com/path-with-dashes',
        'https://example.com/path_with_underscores',
        'https://example.com/path.with.dots',
        'https://example.com/path~with~tildes',
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
        'very-long-subdomain.another-subdomain.example.com',
        'example.com/very/deep/path/structure',
        'example.com:8080',
        'example.com/path?multiple=1&params=true',
        'example.com/path#multiple-sections',
        'sub-domain-with-dashes.example.com',
        'example.com/path-with-dashes',
        'example.com/path_with_underscores',
        'example.com/path.with.dots',
        'example.com/path~with~tildes',
        'a.com', // Minimum valid domain
        'aa.com',
        'a-b.com',
        'example.photography', // Longer TLD
        'subdomain.example.photography',
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
        '.com', // TLD only
        'example.', // Missing TLD
        'http:/example.com', // Malformed protocol (missing slash)
        'https:///example.com', // Too many slashes
        'https//example.com', // Missing colon
        'https:/example.com', // Missing slash
        '-example.com', // Domain starting with hyphen
        'example-.com', // Domain ending with hyphen
        'exam*ple.com', // Invalid characters
        'exam ple.com', // Spaces in domain
        'exa mple.com', // Spaces in domain
        '.example.com', // Starting with dot
        'example..com', // Consecutive dots
        'http://.example.com', // Starting with dot after protocol
        'https://example.com.', // Ending with dot
        'https://exa#mple.com', // Hash in domain
        'https://exa?mple.com', // Question mark in domain
        'https://example.12345678', // TLD too long
        '@example.com', // Starting with @
        'example.c', // TLD too short
        'https:/example.com@malicious.com', // URL with @ symbol
        'http://example.com#@malicious.com', // URL with #@ pattern
        'javascript:alert(1)', // JavaScript protocol
        'data:text/html,<script>alert(1)</script>', // Data protocol
        'file://example.com', // File protocol
        'about:blank', // About protocol
        'localhost', // Localhost without TLD
        'internal', // Internal hostname without TLD
        '192.168.1.1', // IP address (not allowed in this regex)
        '[2001:db8::1]', // IPv6 address (not allowed in this regex)
      ];

      invalidUrls.forEach((url) => {
        expect(WEBSITE_RELAXED_REGEX.test(url)).toBe(false);
      });
    });

    test('should handle edge cases for URL lengths', () => {
      // Test URLs approaching maximum lengths
      const longDomain = 'a'.repeat(63) + '.example.com'; // Max length for DNS label is 63 characters
      const longPath = 'example.com/' + 'a'.repeat(2048); // Common max URL length
      const longSubdomains = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.example.com';

      expect(WEBSITE_RELAXED_REGEX.test(longDomain)).toBe(true);
      expect(WEBSITE_RELAXED_REGEX.test(longPath)).toBe(true);
      expect(WEBSITE_RELAXED_REGEX.test(longSubdomains)).toBe(true);

      // Test invalid lengths
      const tooLongLabel = 'a'.repeat(64) + '.example.com'; // DNS label > 63 chars
      expect(WEBSITE_RELAXED_REGEX.test(tooLongLabel)).toBe(false);
    });
  });
});
