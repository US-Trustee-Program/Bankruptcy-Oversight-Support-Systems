import {
  escapeRegExCharacters,
  normalizeWebsiteUrl,
  WEBSITE_RELAXED_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  ZOOM_MEETING_ID_REGEX,
  ZIP_REGEX,
  WEBSITE_REGEX,
  CASE_NUMBER_REGEX,
  CASE_ID_REGEX,
} from './regex';

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

  describe('EMAIL_REGEX', () => {
    test('should match valid email addresses', () => {
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('user.name@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('user+tag@example.org')).toBe(true);
      expect(EMAIL_REGEX.test('user@sub.example.com')).toBe(true);
    });

    test('should require ^ anchor — reject strings with prefix before email', () => {
      // Kills mutant that removes ^ anchor from EMAIL_REGEX
      expect(EMAIL_REGEX.test('INVALID PREFIX user@example.com')).toBe(false);
    });

    test('should require $ anchor — reject strings with suffix after email', () => {
      // Kills mutant that removes $ anchor from EMAIL_REGEX
      expect(EMAIL_REGEX.test('user@example.com INVALID SUFFIX')).toBe(false);
    });

    test('should require domain to have at least one subdomain part (+ not ? quantifier)', () => {
      // Kills mutant: (?:\.(...))? -> (?:\.(...))+ (no domain part without TLD)
      expect(EMAIL_REGEX.test('user@com')).toBe(false);
      expect(EMAIL_REGEX.test('user@example')).toBe(false);
    });

    test('should allow optional trailing domain part', () => {
      // Verifies that ? quantifier for trailing domain group works
      expect(EMAIL_REGEX.test('user@example.co.uk')).toBe(true);
    });

    test('should allow single-character domain labels (trailing char is optional)', () => {
      // Kills mutant: (?:[a-z0-9-]{0,61}[a-z0-9])? -> (?:[a-z0-9-]{0,61}[a-z0-9])
      // Without the ?, single-char domain labels would be required to have 2+ chars
      expect(EMAIL_REGEX.test('a@b.com')).toBe(true);
      expect(EMAIL_REGEX.test('user@x.com')).toBe(true);
      expect(EMAIL_REGEX.test('user@a.b')).toBe(true);
    });

    test('should reject malformed emails', () => {
      expect(EMAIL_REGEX.test('@example.com')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('not-an-email')).toBe(false);
    });
  });

  describe('PHONE_REGEX', () => {
    test('should match valid phone numbers', () => {
      expect(PHONE_REGEX.test('123-456-7890')).toBe(true);
      expect(PHONE_REGEX.test('1-123-456-7890')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 x123')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 ext. 12345')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 extension: 1')).toBe(true);
    });

    test('should require ^ anchor — reject phone numbers with leading text', () => {
      // Kills mutant that removes ^ anchor
      expect(PHONE_REGEX.test('call 123-456-7890')).toBe(false);
    });

    test('should require $ anchor — reject phone numbers with trailing text', () => {
      // Kills mutant that removes $ anchor
      expect(PHONE_REGEX.test('123-456-7890 and more')).toBe(false);
    });

    test('should require + (one or more) whitespace before extension — not * (zero or more)', () => {
      // Kills mutant: \s+ -> \s (requires at least one space before extension)
      expect(PHONE_REGEX.test('123-456-7890x123')).toBe(false);
      expect(PHONE_REGEX.test('123-456-7890ext.123')).toBe(false);
    });

    test('should allow multiple spaces before extension', () => {
      // Kills mutant: \s+ -> \s (single \s only matches one space)
      // \s+ should match 2+ spaces before extension
      expect(PHONE_REGEX.test('123-456-7890  x123')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890   ext.123')).toBe(true);
    });

    test('should not match non-whitespace before extension', () => {
      // Kills mutant: \s+ -> \S+
      // A hyphen (non-whitespace) before extension should not match
      expect(PHONE_REGEX.test('123-456-7890-ext.123')).toBe(false);
    });

    test('should require optional dot in ext abbreviation', () => {
      // Ensures ext. and ext both match (? makes dot optional)
      expect(PHONE_REGEX.test('123-456-7890 ext.123')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 ext123')).toBe(true);
    });

    test('should match extension with 1 to 6 digits', () => {
      expect(PHONE_REGEX.test('123-456-7890 x1')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 x123456')).toBe(true);
    });

    test('should reject extension with 7 or more digits', () => {
      // Kills mutant: {1,6} -> {1} (only 1 digit)
      expect(PHONE_REGEX.test('123-456-7890 x1234567')).toBe(false);
    });

    test('should reject extension with non-digits', () => {
      // Kills mutant: \d -> \D
      expect(PHONE_REGEX.test('123-456-7890 xABC')).toBe(false);
    });

    test('should allow optional whitespace after extension keyword', () => {
      // Verifies \s* allows zero-or-more spaces after ext
      expect(PHONE_REGEX.test('123-456-7890 ext.  123')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 ext. 123')).toBe(true);
    });

    test('should not match non-whitespace after extension keyword', () => {
      // Kills mutant: \s* -> \S*
      expect(PHONE_REGEX.test('123-456-7890 extA123')).toBe(false);
    });

    test('should allow optional extension — no extension is valid', () => {
      expect(PHONE_REGEX.test('123-456-7890')).toBe(true);
    });

    test('should require valid separator in extension syntax', () => {
      // Kills mutant: [:.]? -> [:.] (removing optional)
      expect(PHONE_REGEX.test('123-456-7890 extension 123')).toBe(true);
      expect(PHONE_REGEX.test('123-456-7890 extension:123')).toBe(true);
    });

    test('should reject invalid separator chars in extension', () => {
      // Kills mutant: [:.]? -> [^:.]? (negated character class)
      expect(PHONE_REGEX.test('123-456-7890 extension;123')).toBe(false);
    });
  });

  describe('ZOOM_MEETING_ID_REGEX', () => {
    test('should match valid zoom meeting IDs (9-11 digits)', () => {
      expect(ZOOM_MEETING_ID_REGEX.test('123456789')).toBe(true); // 9 digits
      expect(ZOOM_MEETING_ID_REGEX.test('1234567890')).toBe(true); // 10 digits
      expect(ZOOM_MEETING_ID_REGEX.test('12345678901')).toBe(true); // 11 digits
    });

    test('should require ^ anchor — reject IDs with leading characters', () => {
      // Kills mutant that removes ^ anchor
      expect(ZOOM_MEETING_ID_REGEX.test('ID123456789')).toBe(false);
    });

    test('should require $ anchor — reject IDs with trailing characters', () => {
      // Kills mutant that removes $ anchor
      expect(ZOOM_MEETING_ID_REGEX.test('123456789 extra')).toBe(false);
    });

    test('should reject IDs with fewer than 9 digits', () => {
      expect(ZOOM_MEETING_ID_REGEX.test('12345678')).toBe(false); // 8 digits
    });

    test('should reject IDs with more than 11 digits', () => {
      expect(ZOOM_MEETING_ID_REGEX.test('123456789012')).toBe(false); // 12 digits
    });

    test('should reject non-digit characters', () => {
      expect(ZOOM_MEETING_ID_REGEX.test('12345678A')).toBe(false);
      expect(ZOOM_MEETING_ID_REGEX.test('12345678-')).toBe(false);
    });
  });

  describe('ZIP_REGEX', () => {
    test('should match valid 5-digit zip codes', () => {
      expect(ZIP_REGEX.test('12345')).toBe(true);
      expect(ZIP_REGEX.test('00000')).toBe(true);
      expect(ZIP_REGEX.test('99999')).toBe(true);
    });

    test('should match valid 9-digit zip codes', () => {
      expect(ZIP_REGEX.test('12345-6789')).toBe(true);
      expect(ZIP_REGEX.test('00000-0000')).toBe(true);
    });

    test('should require ^ anchor — reject zip with leading text', () => {
      // Kills mutant that removes ^ anchor
      expect(ZIP_REGEX.test('zip: 12345')).toBe(false);
    });

    test('should require $ anchor — reject zip with trailing text', () => {
      // Kills mutant that removes $ anchor
      expect(ZIP_REGEX.test('12345 extra')).toBe(false);
    });

    test('should reject 4-digit codes', () => {
      expect(ZIP_REGEX.test('1234')).toBe(false);
    });

    test('should reject 6-digit codes', () => {
      expect(ZIP_REGEX.test('123456')).toBe(false);
    });

    test('should reject zip with wrong separator', () => {
      expect(ZIP_REGEX.test('12345_6789')).toBe(false);
      expect(ZIP_REGEX.test('123456789')).toBe(false);
    });
  });

  describe('WEBSITE_REGEX', () => {
    test('should match valid https URLs', () => {
      expect(WEBSITE_REGEX.test('https://example.com')).toBe(true);
      expect(WEBSITE_REGEX.test('http://example.com')).toBe(true);
      expect(WEBSITE_REGEX.test('https://www.example.com')).toBe(true);
      expect(WEBSITE_REGEX.test('https://example.com/path')).toBe(true);
      expect(WEBSITE_REGEX.test('https://example.com:8080')).toBe(true);
    });

    test('should require ^ anchor — reject URLs with leading text', () => {
      // Kills mutant removing ^ from WEBSITE_REGEX
      expect(WEBSITE_REGEX.test('visit https://example.com')).toBe(false);
    });

    test('should require $ anchor — reject URLs with trailing text', () => {
      // Kills mutant removing $ from WEBSITE_REGEX
      expect(WEBSITE_REGEX.test('https://example.com and more')).toBe(false);
    });

    test('should only match http or https protocol (not ftp etc.)', () => {
      // Kills mutant: https? -> https (removes optional s)
      expect(WEBSITE_REGEX.test('http://example.com')).toBe(true);
      expect(WEBSITE_REGEX.test('ftp://example.com')).toBe(false);
    });

    test('should require subdomains with + quantifier (one or more domain parts)', () => {
      // Kills mutant: (...\.)+ -> (...\.) (removes + making it require exactly one)
      expect(WEBSITE_REGEX.test('https://a.b.example.com')).toBe(true);
    });

    test('should require subdomain labels with 1-63 chars', () => {
      // Kills mutant: {1,63} -> no quantifier (only 1 char)
      const longLabel = 'a'.repeat(63) + '.example.com';
      expect(WEBSITE_REGEX.test('https://' + longLabel)).toBe(true);
      const tooLongLabel = 'a'.repeat(64) + '.example.com';
      expect(WEBSITE_REGEX.test('https://' + tooLongLabel)).toBe(false);
    });

    test('should reject domain label starting with hyphen', () => {
      // Kills mutant: (?!-) -> (?=-)
      expect(WEBSITE_REGEX.test('https://-example.com')).toBe(false);
    });

    test('should reject domain label ending with hyphen', () => {
      // Kills mutant: (?<!-) -> (?<=-)
      expect(WEBSITE_REGEX.test('https://example-.com')).toBe(false);
    });

    test('should require TLD of 2-63 letters', () => {
      // Kills mutant: [a-zA-Z]{2,63} -> [a-zA-Z] (only 1 char)
      expect(WEBSITE_REGEX.test('https://example.c')).toBe(false);
      expect(WEBSITE_REGEX.test('https://example.co')).toBe(true);
    });

    test('should reject domains with only non-alphanumeric chars', () => {
      // Kills mutant: [-a-zA-Z0-9] -> [^-a-zA-Z0-9]
      expect(WEBSITE_REGEX.test('https://$$$.com')).toBe(false);
    });

    test('should reject non-letter TLD', () => {
      // Kills mutant: [a-zA-Z]{2,63} -> [^a-zA-Z]{2,63}
      expect(WEBSITE_REGEX.test('https://example.123')).toBe(false);
    });

    test('should make port number optional', () => {
      // Kills mutant: (?::\d+)? -> (?::\d+) (removes optional ?)
      expect(WEBSITE_REGEX.test('https://example.com')).toBe(true);
      expect(WEBSITE_REGEX.test('https://example.com:80')).toBe(true);
    });

    test('should require port as digits not non-digits', () => {
      // Kills mutant: \d+ -> \D+
      expect(WEBSITE_REGEX.test('https://example.com:abc')).toBe(false);
    });

    test('should require port to have 1 or more digits', () => {
      // Kills mutant: \d+ -> \d (only one digit)
      expect(WEBSITE_REGEX.test('https://example.com:8080')).toBe(true);
    });

    test('should make path optional', () => {
      // Kills mutant removing ? after path group
      expect(WEBSITE_REGEX.test('https://example.com')).toBe(true);
      expect(WEBSITE_REGEX.test('https://example.com/')).toBe(true);
    });

    test('should allow long paths with multiple chars', () => {
      // Kills mutant: * -> (empty/removed)
      expect(WEBSITE_REGEX.test('https://example.com/very/long/path/here')).toBe(true);
    });

    test('should not match negative character class in path', () => {
      // Kills mutant: [-a-zA-Z...] -> [^-a-zA-Z...]
      expect(WEBSITE_REGEX.test('https://example.com/path-with-dashes')).toBe(true);
    });
  });

  describe('CASE_NUMBER_REGEX', () => {
    test('should match valid case numbers', () => {
      expect(CASE_NUMBER_REGEX.test('12-34567')).toBe(true);
      expect(CASE_NUMBER_REGEX.test('00-00000')).toBe(true);
      expect(CASE_NUMBER_REGEX.test('99-99999')).toBe(true);
    });

    test('should reject malformed case numbers', () => {
      expect(CASE_NUMBER_REGEX.test('1-34567')).toBe(false);
      expect(CASE_NUMBER_REGEX.test('123-34567')).toBe(false);
      expect(CASE_NUMBER_REGEX.test('12-3456')).toBe(false);
      expect(CASE_NUMBER_REGEX.test('12-345678')).toBe(false);
      expect(CASE_NUMBER_REGEX.test('AB-34567')).toBe(false);
    });
  });

  describe('CASE_ID_REGEX', () => {
    test('should match valid case IDs', () => {
      expect(CASE_ID_REGEX.test('123-45-67890')).toBe(true);
      expect(CASE_ID_REGEX.test('000-00-00000')).toBe(true);
      expect(CASE_ID_REGEX.test('999-99-99999')).toBe(true);
    });

    test('should require ^ anchor — reject case IDs with leading text', () => {
      // Kills mutant that removes ^ anchor from CASE_ID_REGEX
      expect(CASE_ID_REGEX.test('x123-45-67890')).toBe(false);
    });

    test('should require $ anchor — reject case IDs with trailing text', () => {
      // Kills mutant that removes $ anchor from CASE_ID_REGEX
      expect(CASE_ID_REGEX.test('123-45-67890 extra')).toBe(false);
    });

    test('should require exactly 3 digits in first segment', () => {
      // Kills mutant: \d{3} -> \d (only 1 digit)
      expect(CASE_ID_REGEX.test('12-45-67890')).toBe(false);
      expect(CASE_ID_REGEX.test('1234-45-67890')).toBe(false);
    });

    test('should reject non-digits in first segment', () => {
      // Kills mutant: \d{3} -> \D{3}
      expect(CASE_ID_REGEX.test('ABC-45-67890')).toBe(false);
    });

    test('should require exactly 2 digits in second segment', () => {
      // Kills mutant: \d{2} -> \d (only 1 digit)
      expect(CASE_ID_REGEX.test('123-4-67890')).toBe(false);
      expect(CASE_ID_REGEX.test('123-456-67890')).toBe(false);
    });

    test('should reject non-digits in second segment', () => {
      // Kills mutant: \d{2} -> \D{2}
      expect(CASE_ID_REGEX.test('123-AB-67890')).toBe(false);
    });

    test('should require exactly 5 digits in third segment', () => {
      // Kills mutant: \d{5} -> \d (only 1 digit)
      expect(CASE_ID_REGEX.test('123-45-6789')).toBe(false);
      expect(CASE_ID_REGEX.test('123-45-678901')).toBe(false);
    });

    test('should reject non-digits in third segment', () => {
      // Kills mutant: \d{5} -> \D{5}
      expect(CASE_ID_REGEX.test('123-45-ABCDE')).toBe(false);
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

    test('should return empty string for non-string inputs that are truthy', () => {
      // Kills mutant: !url || typeof url !== 'string' -> !url && typeof url !== 'string'
      // When url is a non-empty non-string (e.g. number), it would pass !url check (truthy)
      // but must still be caught by typeof check
      expect(normalizeWebsiteUrl(42 as unknown as string)).toBe('');
      expect(normalizeWebsiteUrl({} as unknown as string)).toBe('');
      expect(normalizeWebsiteUrl([] as unknown as string)).toBe('');
    });

    test('should return empty string for false-y non-string values', () => {
      // Kills mutant: typeof url !== 'string' -> false (ConditionalExpression)
      // When url is 0 (falsy but typeof 0 !== 'string'), should still return ''
      expect(normalizeWebsiteUrl(0 as unknown as string)).toBe('');
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

    test('should detect http:// at start only — not embedded in middle of string', () => {
      // Kills mutant: /^https?:\/\//.test -> /https?:\/\//.test (removes ^)
      // A string that contains https:// in the middle should NOT be treated as having
      // a http/https protocol (the hasProtocol check would catch it separately)
      expect(normalizeWebsiteUrl('nothttp://example.com')).toBe('');
    });

    test('should only detect protocol at the start of string in hasProtocol (internal)', () => {
      // Kills mutant: /^[a-zA-Z][a-zA-Z0-9+.-]*:/ -> /[a-zA-Z][a-zA-Z0-9+.-]*/
      // hasProtocol is used to check the "afterProtocol" portion and "trimmedUrl"
      // Without ^ anchor, a domain like "example.com" could falsely match because
      // ".com" contains a letter followed by a colon-less match... but the key test:
      // A URL like "example.ftp://embedded" should add https:// (ftp is embedded, not at start of afterProtocol segment)
      // With ^ in hasProtocol: "ftp://embedded" (afterProtocol of "http://example.ftp://embedded")
      //   would be detected as having protocol "ftp:" at start => return ''
      // This tests that strings with non-protocol text BEFORE the protocol in afterProtocol
      // are handled correctly
      // "http://some-textftp://badsite.com" -> afterProtocol = "some-textftp://badsite.com"
      // Without ^: "some-textftp://badsite.com" matches because "textftp:" appears
      // With ^: "some-textftp://badsite.com" does NOT match at start (starts with 's')
      expect(normalizeWebsiteUrl('http://legitimate.comftp://embedded.com')).toBe('');
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
