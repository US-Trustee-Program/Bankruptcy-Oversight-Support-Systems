import { sanitizeDeep } from './validations';

describe('sanitizeDeep', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  test('should sanitize a simple string', () => {
    const testString = 'Hello World 你好 with emoji 🚀';
    const sanitized = sanitizeDeep(testString, 'TEST-MODULE');
    expect(sanitized).toEqual('Hello World  with emoji ');
  });

  test('should sanitize an array of strings', () => {
    const testArray = ['Hello', 'World 世界', 'Test 😊 emoji'];
    const sanitized = sanitizeDeep(testArray, 'TEST-MODULE');
    expect(sanitized).toEqual(['Hello', 'World ', 'Test  emoji']);
  });

  test('should recursively sanitize an object', () => {
    const testObject = {
      name: 'Test 你好',
      value: 123,
      nested: { key: 'Nested Value 💡', nestedArray: ['thing1 ©', 'thing2 🔥'] },
    };
    const sanitized = sanitizeDeep(testObject, 'TEST-MODULE');
    expect(sanitized).toEqual({
      name: 'Test ',
      value: 123,
      nested: {
        key: 'Nested Value ',
        nestedArray: ['thing1 ', 'thing2 '],
      },
    });
  });

  test('should detect and ignore cyclic references in objects', () => {
    const testObject = { name: 'Test', testObject: null };
    testObject.testObject = testObject;
    const sanitized = sanitizeDeep(testObject, 'TEST-MODULE');
    expect(sanitized).toEqual({ name: 'Test', testObject: null });
  });

  test('should throw an error when max depth of an object is exceeded', () => {
    process.env.MAX_OBJECT_DEPTH = '5';
    const testObject = {
      level1: { level2: { level3: { level4: { level5: { level6: 'deep' } } } } },
    };

    expect(() => sanitizeDeep(testObject, 'TEST-MODULE')).toThrow('Max depth exceeded');
  });

  test('should throw an error when max key count of an object is exceeded', () => {
    process.env.MAX_OBJECT_KEY_COUNT = '2';
    const testObject = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };

    expect(() => sanitizeDeep(testObject, 'TEST-MODULE')).toThrow('Max key count exceeded');
  });

  test('should throw BadRequestError for invalid user input', () => {
    const testStringsWithScriptInjection = [
      '<script>alert("XSS")</script>',
      'Check this document.querySelector("input").value',
      'function() { eval("malicious code"); }',
      'fetch("/api/sensitive-data")',
    ];

    const testStringsWithMongoInjection = [
      'Find me with $where: {evil: true}',
      'Apply $and operator',
      'Use $elemMatch to find documents',
    ];

    testStringsWithScriptInjection.forEach((testString) => {
      expect(() => sanitizeDeep(testString, 'TEST-MODULE')).toThrow('Invalid user input.');
    });

    testStringsWithMongoInjection.forEach((testString) => {
      expect(() => sanitizeDeep(testString, 'TEST-MODULE')).toThrow('Invalid user input.');
    });

    const testObject = {
      name: 'Test',
      description: '<script>alert("XSS")</script>',
    };

    expect(() => sanitizeDeep(testObject, 'TEST-MODULE')).toThrow('Invalid user input.');
  });
});
