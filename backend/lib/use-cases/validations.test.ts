import { sanitizeDeep } from './validations';

describe('sanitizeDeep', () => {
  const originalEnv = process.env;

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should detect and ignore cyclic references in objects', () => {
    const testObject = { name: 'Test', testObject: null };
    testObject.testObject = testObject;
    const sanitized = sanitizeDeep(testObject);
    expect(sanitized).toEqual({ name: 'Test', testObject: null });
  });

  test('should throw an error when max depth of an object is exceeded', () => {
    process.env.MAX_OBJECT_DEPTH = '5';
    const testObject = {
      level1: { level2: { level3: { level4: { level5: { level6: 'deep' } } } } },
    };

    expect(() => sanitizeDeep(testObject)).toThrow('Max depth exceeded');
  });

  test('should throw an error when max key count of an object is exceeded', () => {
    process.env.MAX_OBJECT_KEY_COUNT = '2';
    const testObject = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };

    expect(() => sanitizeDeep(testObject)).toThrow('Max key count exceeded');
  });
});
