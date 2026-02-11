import {
  maskToExtendedAscii,
  isValidUserInput,
  filterToExtendedAscii,
  sanitizeUrl,
  sanitizeDeepCore,
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
    });
  });
});
