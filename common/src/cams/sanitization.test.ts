import {
  maskToExtendedAscii,
  isValidUserInput,
  filterToExtendedAscii,
  sanitizeUrl,
  sanitizeDeepCore,
  sanitizeDeep,
  SanitizationError,
} from './sanitization';

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
      ['<iframe>content</iframe>'],
      ['<iframe src="evil.com">'],
      ['<noscript>content</noscript>'],
      ['<xmp>content</xmp>'],
      ['<noembed>content</noembed>'],
      ['<noframes>content</noframes>'],
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

    describe('MONGO_CONSOLE_INJECTED_PATTERN', () => {
      test('should detect db. followed by multiple letters', () => {
        expect(isValidUserInput('db.findOne()')).toBe(false);
        expect(isValidUserInput('db.collection')).toBe(false);
        expect(isValidUserInput('db.ab')).toBe(false);
      });

      test('should require multiple letters after db. (+ quantifier not single char)', () => {
        expect(isValidUserInput('db.findOne')).toBe(false);
        expect(isValidUserInput('db.collections')).toBe(false);
      });

      test('should detect db. patterns even with single letter followed by more', () => {
        expect(isValidUserInput('db.a')).toBe(false);
        expect(isValidUserInput('db.find')).toBe(false);
      });

      test('should detect mongo. followed by multiple letters', () => {
        expect(isValidUserInput('mongo.connect()')).toBe(false);
        expect(isValidUserInput('mongo.db')).toBe(false);
      });

      test('should require multiple letters after mongo. (+ quantifier not single char)', () => {
        expect(isValidUserInput('mongo.collections')).toBe(false);
      });

      test('should not match db. followed by non-letter characters', () => {
        expect(isValidUserInput('db.123')).toBe(true);
        expect(isValidUserInput('db.!!')).toBe(true);
      });

      test('should allow optional whitespace before : in mongo commands', () => {
        expect(isValidUserInput('find :{}')).toBe(false);
        expect(isValidUserInput('find  :{}')).toBe(false);
        expect(isValidUserInput('find:{}')).toBe(false);
      });

      test('should not allow non-whitespace separator before : in mongo command pattern', () => {
        expect(isValidUserInput('find :{}')).toBe(false);
        expect(isValidUserInput('find:{}')).toBe(false);
      });
    });

    describe('JAVASCRIPT_INJECTED_PATTERN', () => {
      test('should detect script tags with attributes', () => {
        expect(isValidUserInput('<script type="text/javascript">alert(1)</script>')).toBe(false);
        expect(isValidUserInput('<script src="evil.js">x</script>')).toBe(false);
      });

      test('should detect script tags with content spanning newlines', () => {
        expect(isValidUserInput('<script>\nalert(1)\n</script>')).toBe(false);
        expect(isValidUserInput('<script>\n\t\nmalicious code\n</script>')).toBe(false);
      });

      test('should detect fetch with zero or more spaces before (', () => {
        expect(isValidUserInput("fetch('/api/data')")).toBe(false);
        expect(isValidUserInput("fetch ('/api/data')")).toBe(false);
        expect(isValidUserInput('fetch  (url)')).toBe(false);
      });

      test('should not require non-whitespace before fetch (', () => {
        expect(isValidUserInput('fetch(url)')).toBe(false);
      });

      test('should detect eval with zero or more spaces before (', () => {
        expect(isValidUserInput('eval(code)')).toBe(false);
        expect(isValidUserInput('eval (code)')).toBe(false);
        expect(isValidUserInput('eval  (code)')).toBe(false);
      });

      test('should not require non-whitespace before eval (', () => {
        expect(isValidUserInput("eval   ('bad')")).toBe(false);
      });

      test('should detect window. with single-char identifier (kills * -> no-* mutant)', () => {
        expect(isValidUserInput('window.x')).toBe(false);
        expect(isValidUserInput('window.a')).toBe(false);
      });

      test('should detect window. with multiple identifier chars', () => {
        expect(isValidUserInput('window.location')).toBe(false);
        expect(isValidUserInput('window.open')).toBe(false);
        expect(isValidUserInput('window.location.href')).toBe(false);
      });

      test('should detect window. with valid identifier starting chars', () => {
        expect(isValidUserInput('window._private')).toBe(false);
        expect(isValidUserInput('window.$jquery')).toBe(false);
      });

      test('should not detect window. followed by non-identifier chars as injection', () => {
        expect(isValidUserInput('window.123')).toBe(true);
      });

      test('should detect window. with valid subsequent identifier chars (not negated)', () => {
        expect(isValidUserInput('window.abc123')).toBe(false);
        expect(isValidUserInput('window.a1b2c3')).toBe(false);
      });

      test('should detect document. with single-char identifier (kills * -> no-* mutant)', () => {
        expect(isValidUserInput('document.x')).toBe(false);
        expect(isValidUserInput('document.a')).toBe(false);
      });

      test('should detect document. with multiple identifier chars', () => {
        expect(isValidUserInput('document.getElementById')).toBe(false);
        expect(isValidUserInput('document.write')).toBe(false);
      });

      test('should detect document. with valid identifier starting chars', () => {
        expect(isValidUserInput('document._hidden')).toBe(false);
        expect(isValidUserInput('document.$method')).toBe(false);
      });

      test('should not detect document. followed by non-identifier chars as injection', () => {
        expect(isValidUserInput('document.123')).toBe(true);
      });

      test('should detect document. with valid subsequent identifier chars (not negated)', () => {
        expect(isValidUserInput('document.abc123')).toBe(false);
        expect(isValidUserInput('document.a1')).toBe(false);
      });
    });
  });

  describe('maskToExtendedAscii', () => {
    const testStrings: [string, string, string | undefined][] = [
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

  describe('sanitizeUrl', () => {
    const validUrls = [
      ['http://example.com', 'http://example.com'],
      ['https://example.com', 'https://example.com'],
      ['mailto:user@example.com', 'mailto:user@example.com'],
      ['http://example.com/path', 'http://example.com/path'],
      ['https://example.com/path?query=value', 'https://example.com/path?query=value'],
      ['https://subdomain.example.com:8080/path', 'https://subdomain.example.com:8080/path'],
      ['mailto:test.user+tag@example-domain.com', 'mailto:test.user+tag@example-domain.com'],
      ['http://192.168.1.1', 'http://192.168.1.1'],
      ['https://example.com/path#fragment', 'https://example.com/path#fragment'],
    ];

    test.each(validUrls)('should allow valid URL: %s', (input: string, expected: string) => {
      expect(sanitizeUrl(input)).toEqual(expected);
    });

    const invalidUrls = [
      ['javascript:alert("xss")'],
      ['data:text/html,<script>alert("xss")</script>'],
      ['ftp://example.com'],
      ['file:///etc/passwd'],
      ['vbscript:msgbox("xss")'],
      ['about:blank'],
      ['chrome://settings'],
      [''],
      ['not-a-url'],
      ['http://'],
      ['https://'],
      ['mailto:'],
      ['http:example.com'],
      ['https:example.com'],
      ['http//example.com'],
      ['ht tp://example.com'],
      ['http://exam ple.com'],
      ['http://example..com'],
      ['http://.example.com'],
      ['http://example.com.'],
    ];

    test.each(invalidUrls)('should return empty string for invalid URL: %s', (input: string) => {
      expect(sanitizeUrl(input)).toEqual('');
    });

    describe('validUrlPattern anchor requirements', () => {
      test('should require ^ anchor — reject URL with prefix before the protocol', () => {
        expect(sanitizeUrl('xhttps://example.com')).toBe('');
        expect(sanitizeUrl('1http://example.com')).toBe('');
      });

      test('should require $ anchor — reject URL with non-space suffix after valid URL', () => {
        expect(sanitizeUrl('https://example.com\nextra')).toBe('');
      });

      test('should allow 2-char TLD in final host (kills {0,61} removal mutant)', () => {
        expect(sanitizeUrl('http://example.io')).toBe('http://example.io');
        expect(sanitizeUrl('https://example.co')).toBe('https://example.co');
        expect(sanitizeUrl('http://subdomain.example.io')).toBe('http://subdomain.example.io');
      });
    });

    describe('sanitizeUrl - protocol-only and malformed inputs', () => {
      test('should return empty string for protocol-only http://', () => {
        expect(sanitizeUrl('http://')).toBe('');
      });
      test('should return empty string for protocol-only https://', () => {
        expect(sanitizeUrl('https://')).toBe('');
      });
      test('should return empty string for mailto: URI scheme', () => {
        expect(sanitizeUrl('mailto:')).toBe('');
      });
      test('should return empty string for URL with trailing dot', () => {
        expect(sanitizeUrl('http://example.com.')).toBe('');
      });
      test('should return empty string for URL with space in host', () => {
        expect(sanitizeUrl('http://exam ple.com')).toBe('');
      });
      test('should return empty string for URL with double dot', () => {
        expect(sanitizeUrl('http://example..com')).toBe('');
      });
    });
  });

  describe('sanitizeDeep', () => {
    test('should return sanitized value directly', () => {
      const input = { name: 'safe text', age: 30 };
      const result = sanitizeDeep(input);
      expect(result).toEqual({ name: 'safe text', age: 30 });
    });

    test('should strip invalid strings by default', () => {
      const input = { script: '<script>alert("xss")</script>', safe: 'hello' };
      const result = sanitizeDeep(input);
      expect(result.script).toBe('');
      expect(result.safe).toBe('hello');
    });

    test('should call onStripped callback for invalid strings', () => {
      const strippedValues: string[] = [];
      const input = { script: '<script>alert("xss")</script>' };
      sanitizeDeep(input, true, (invalidString) => {
        strippedValues.push(invalidString);
      });
      expect(strippedValues).toEqual(['<script>alert("xss")</script>']);
    });

    test('should scrub unicode by default (scrubUnicode=true)', () => {
      const input = { text: 'Hello 世界' };
      const result = sanitizeDeep(input);
      expect(result.text).toBe('Hello ');
    });

    test('should preserve unicode when scrubUnicode=false', () => {
      const input = { text: 'Hello 世界' };
      const result = sanitizeDeep(input, false);
      expect(result.text).toBe('Hello 世界');
    });

    test('should throw SanitizationError when max depth exceeded', () => {
      const deepObject = Array.from({ length: 60 }, () => ({})).reduce(
        (acc, _) => ({ nested: acc }),
        { value: 'deep' },
      );
      expect(() => sanitizeDeep(deepObject)).toThrow(SanitizationError);
      expect(() => sanitizeDeep(deepObject)).toThrow(/Max depth exceeded:/);
      expect(() => sanitizeDeep(deepObject)).toThrow(/>/);
    });

    test('should throw SanitizationError when max key count exceeded', () => {
      const largeObject = Object.fromEntries(
        Array.from({ length: 1100 }, (_, i) => [`key${i}`, `value${i}`]),
      );
      expect(() => sanitizeDeep({ data: largeObject })).toThrow(SanitizationError);
      expect(() => sanitizeDeep({ data: largeObject })).toThrow(/Max key count exceeded:/);
      expect(() => sanitizeDeep({ data: largeObject })).toThrow(/>/);
    });

    test('should sanitize deep structures with maxObjectDepth default of 50', () => {
      const input = { a: { b: 'safe text' } };
      const result = sanitizeDeep(input);
      expect(result.a.b).toBe('safe text');
    });

    test('should use maxObjectKeyCount default of 1000 in sanitizeDeep', () => {
      const exactlyAtLimitObject = Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`]),
      );
      expect(() => sanitizeDeep(exactlyAtLimitObject)).not.toThrow();
    });
  });

  describe('SanitizationError', () => {
    test('should have name property set to SanitizationError', () => {
      const error = new SanitizationError('test message');
      expect(error.name).toBe('SanitizationError');
      expect(error.message).toBe('test message');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('sanitizeDeepCore', () => {
    describe('basic sanitization', () => {
      test('should sanitize strings in objects', () => {
        const input = { name: '<script>alert("xss")</script>', age: 30 };
        const strippedValues: string[] = [];

        const result = sanitizeDeepCore(input, {
          onInvalidInput: (invalidString) => {
            strippedValues.push(invalidString);
            return '';
          },
        });

        expect(result.value).toEqual({ name: '', age: 30 });
        expect(strippedValues).toEqual(['<script>alert("xss")</script>']);
        expect(result.metadata.strippedCount).toBe(1);
      });

      test('should sanitize strings in nested structures', () => {
        const input = {
          user: {
            name: 'John',
            bio: '$where: function() { return true; }',
          },
          tags: ['safe', 'document.getElementById("test")'],
        };
        const strippedValues: string[] = [];

        const result = sanitizeDeepCore(input, {
          onInvalidInput: (invalidString) => {
            strippedValues.push(invalidString);
            return '[REMOVED]';
          },
        });

        expect(result.value).toEqual({
          user: {
            name: 'John',
            bio: '[REMOVED]',
          },
          tags: ['safe', '[REMOVED]'],
        });
        expect(strippedValues).toEqual([
          '$where: function() { return true; }',
          'document.getElementById("test")',
        ]);
        expect(result.metadata.strippedCount).toBe(2);
      });
    });

    describe('callback behavior', () => {
      test('should invoke onInvalidInput and use returned value', () => {
        const input = { script: '<script>alert("xss")</script>' };
        let callbackInvoked = false;

        const result = sanitizeDeepCore(input, {
          onInvalidInput: (invalidString) => {
            callbackInvoked = true;
            expect(invalidString).toBe('<script>alert("xss")</script>');
            return '[SANITIZED]';
          },
        });

        expect(callbackInvoked).toBe(true);
        expect(result.value).toEqual({ script: '[SANITIZED]' });
      });

      test('should throw when onInvalidInput throws', () => {
        const input = { script: '<script>alert("xss")</script>' };

        expect(() => {
          sanitizeDeepCore(input, {
            onInvalidInput: () => {
              throw new Error('Invalid input detected');
            },
          });
        }).toThrow('Invalid input detected');
      });

      test('should pass through invalid input when no callback provided', () => {
        const input = { script: '<script>alert("xss")</script>' };

        const result = sanitizeDeepCore(input, {});

        expect(result.value).toEqual({ script: '<script>alert("xss")</script>' });
        expect(result.metadata.strippedCount).toBe(1);
      });

      test('should invoke onDepthExceeded when max depth exceeded', () => {
        const deepObject = { a: { b: { c: { d: 'value' } } } };
        let callbackInvoked = false;

        sanitizeDeepCore(deepObject, {
          maxObjectDepth: 2,
          onDepthExceeded: (depth, max) => {
            callbackInvoked = true;
            expect(depth).toBeGreaterThan(max);
            expect(max).toBe(2);
          },
        });

        expect(callbackInvoked).toBe(true);
      });

      test('should invoke onKeyCountExceeded when key count exceeded', () => {
        const largeObject = Object.fromEntries(
          Array.from({ length: 15 }, (_, i) => [`key${i}`, `value${i}`]),
        );
        let callbackInvoked = false;

        sanitizeDeepCore(
          { data: largeObject },
          {
            maxObjectKeyCount: 10,
            onKeyCountExceeded: (count, max) => {
              callbackInvoked = true;
              expect(count).toBe(15);
              expect(max).toBe(10);
            },
          },
        );

        expect(callbackInvoked).toBe(true);
      });

      test('should NOT invoke onKeyCountExceeded when key count equals limit', () => {
        const exactObject = Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`key${i}`, `value${i}`]),
        );
        let callbackInvoked = false;

        sanitizeDeepCore(exactObject, {
          maxObjectKeyCount: 10,
          onKeyCountExceeded: () => {
            callbackInvoked = true;
          },
        });

        expect(callbackInvoked).toBe(false);
      });

      test('should invoke onKeyCountExceeded when key count exceeds limit by one', () => {
        const overLimitObject = Object.fromEntries(
          Array.from({ length: 11 }, (_, i) => [`key${i}`, `value${i}`]),
        );
        let callbackInvoked = false;

        sanitizeDeepCore(overLimitObject, {
          maxObjectKeyCount: 10,
          onKeyCountExceeded: (count, max) => {
            callbackInvoked = true;
            expect(count).toBe(11);
            expect(max).toBe(10);
          },
        });

        expect(callbackInvoked).toBe(true);
      });
    });

    describe('metadata tracking', () => {
      test('should track total depth', () => {
        const input = { a: { b: { c: 'value' } } };

        const result = sanitizeDeepCore(input, {});

        expect(result.metadata.totalDepth).toBe(3);
      });

      test('should track total key count', () => {
        const input = {
          key1: 'value1',
          key2: 'value2',
          nested: {
            key3: 'value3',
          },
        };

        const result = sanitizeDeepCore(input, {});

        expect(result.metadata.totalKeyCount).toBe(4);
      });

      test('should track stripped count', () => {
        const input = {
          safe: 'safe value',
          xss1: '<script>alert(1)</script>',
          xss2: 'eval("bad")',
          nested: {
            xss3: 'document.write("test")',
          },
        };

        const result = sanitizeDeepCore(input, {
          onInvalidInput: () => '',
        });

        expect(result.metadata.strippedCount).toBe(3);
      });
    });

    describe('circular references', () => {
      test('should handle circular references', () => {
        interface CircularRef {
          name: string;
          self?: CircularRef;
        }
        const circular: CircularRef = { name: 'test' };
        circular.self = circular;

        const result = sanitizeDeepCore(circular, {});

        expect(result.value.name).toBe('test');
        expect(result.value.self).toBe(result.value);
      });
    });

    describe('unicode handling', () => {
      test('should strip unicode when scrubUnicode is true', () => {
        const input = { text: 'Hello 世界' };

        const result = sanitizeDeepCore(input, { scrubUnicode: true });

        expect(result.value).toEqual({ text: 'Hello ' });
      });

      test('should preserve unicode when scrubUnicode is false', () => {
        const input = { text: 'Hello 世界' };

        const result = sanitizeDeepCore(input, { scrubUnicode: false });

        expect(result.value).toEqual({ text: 'Hello 世界' });
      });

      test('should default scrubUnicode to true', () => {
        const input = { text: 'Test emoji 😀' };

        const result = sanitizeDeepCore(input, {});

        expect(result.value.text).not.toContain('😀');
      });
    });

    describe('edge cases', () => {
      test('should handle primitive types', () => {
        const input = {
          num: 42,
          bool: true,
          nullVal: null,
          undefinedVal: undefined,
        };

        const result = sanitizeDeepCore(input, {});

        expect(result.value).toEqual({
          num: 42,
          bool: true,
          nullVal: null,
          undefinedVal: undefined,
        });
      });

      test('should handle dates', () => {
        const date = new Date('2024-01-01');
        const input = { createdAt: date };

        const result = sanitizeDeepCore(input, {});

        expect(result.value.createdAt).toBeInstanceOf(Date);
        expect(result.value.createdAt.getTime()).toBe(date.getTime());
      });

      test('should handle empty objects and arrays', () => {
        const input = { obj: {}, arr: [] };

        const result = sanitizeDeepCore(input, {});

        expect(result.value).toEqual({ obj: {}, arr: [] });
      });
    });

    describe('default limits', () => {
      test('should use default maxObjectDepth of 50', () => {
        const deepObject = Array.from({ length: 60 }, () => ({})).reduce(
          (acc, _) => ({ nested: acc }),
          { value: 'deep' },
        );
        let callbackInvoked = false;

        sanitizeDeepCore(deepObject, {
          onDepthExceeded: (depth) => {
            callbackInvoked = true;
            expect(depth).toBeGreaterThan(50);
          },
        });

        expect(callbackInvoked).toBe(true);
      });

      test('should use default maxObjectKeyCount of 1000', () => {
        const largeObject = Object.fromEntries(
          Array.from({ length: 1100 }, (_, i) => [`key${i}`, `value${i}`]),
        );
        let callbackInvoked = false;

        sanitizeDeepCore(
          { data: largeObject },
          {
            onKeyCountExceeded: (count) => {
              callbackInvoked = true;
              expect(count).toBe(1100);
            },
          },
        );

        expect(callbackInvoked).toBe(true);
      });

      test('should NOT trigger key count callback at exactly 1000 keys (> not >=)', () => {
        const exactlyAtLimitObject = Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`]),
        );
        let callbackInvoked = false;

        sanitizeDeepCore(exactlyAtLimitObject, {
          onKeyCountExceeded: () => {
            callbackInvoked = true;
          },
        });

        expect(callbackInvoked).toBe(false);
      });
    });
  });
});
