import { describe, expect, vi, beforeEach } from 'vitest';
import LocalFormCache from './local-form-cache';
import { mockLocalStorage } from '../testing/mock-local-storage';

describe('LocalFormCache', () => {
  beforeAll(() => {
    vi.stubEnv('CAMS_DISABLE_LOCAL_CACHE', 'false');
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const testKey = 'foo';
  const expectedTestKey = 'cams:cache:form:foo';
  const formData = {
    foo: 'bar',
  };

  test('should save form data', () => {
    LocalFormCache.saveForm(testKey, formData);

    const jsonInCache = mockLocalStorage.getItem(expectedTestKey);
    const inCache = JSON.parse(jsonInCache!);

    expect(inCache.value).toEqual(formData);
  });

  test('should get form data', () => {
    LocalFormCache.saveForm(testKey, formData);

    const actual = LocalFormCache.getForm(testKey);
    expect(actual).toEqual({ value: formData, expiresAfter: expect.any(Number) });
  });

  test('should remove all form data', () => {
    const testKeys = [testKey, testKey + '2', testKey + '3'];
    testKeys.forEach((key) => {
      LocalFormCache.saveForm(key, formData);
    });
    expect(mockLocalStorage.length).toEqual(testKey.length);

    LocalFormCache.removeAll();
    expect(mockLocalStorage.length).toEqual(0);
  });

  describe('getFormsByPattern', () => {
    test('should return empty array when no forms exist', () => {
      const pattern = /^foo/;
      const result = LocalFormCache.getFormsByPattern(pattern);
      expect(result).toEqual([]);
    });

    test('should return empty array when no forms match pattern', () => {
      // Save forms with keys that don't match the pattern
      LocalFormCache.saveForm('bar1', formData);
      LocalFormCache.saveForm('bar2', formData);
      LocalFormCache.saveForm('baz', formData);

      const pattern = /^foo/;
      const result = LocalFormCache.getFormsByPattern(pattern);
      expect(result).toEqual([]);
    });

    test('should return matching forms when some forms match pattern', () => {
      LocalFormCache.saveForm('foo1', { id: 1 });
      LocalFormCache.saveForm('foo2', { id: 2 });
      LocalFormCache.saveForm('bar', { id: 3 });

      const pattern = /^foo/;
      const result = LocalFormCache.getFormsByPattern(pattern);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { key: 'foo1', form: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
          { key: 'foo2', form: { value: { id: 2 }, expiresAfter: expect.any(Number) } },
        ]),
      );
    });

    test('should return all forms when all forms match pattern', () => {
      // Save forms with keys that all match the pattern
      LocalFormCache.saveForm('case-notes-123', { id: 1 });
      LocalFormCache.saveForm('case-notes-456', { id: 2 });
      LocalFormCache.saveForm('case-notes-789', { id: 3 });

      const pattern = /^case-notes-/;
      const result = LocalFormCache.getFormsByPattern(pattern);

      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          { key: 'case-notes-123', form: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
          { key: 'case-notes-456', form: { value: { id: 2 }, expiresAfter: expect.any(Number) } },
          { key: 'case-notes-789', form: { value: { id: 3 }, expiresAfter: expect.any(Number) } },
        ]),
      );
    });

    test('should match forms using complex regex patterns', () => {
      // Save forms with various keys
      LocalFormCache.saveForm('case-notes-123', { id: 1 });
      LocalFormCache.saveForm('case-notes-456', { id: 2 });
      LocalFormCache.saveForm('other-form-789', { id: 3 });
      LocalFormCache.saveForm('form-123-notes', { id: 4 });

      // Pattern that matches keys containing 'notes' followed by a dash and numbers
      const pattern = /notes-\d+$/;
      const result = LocalFormCache.getFormsByPattern(pattern);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { key: 'case-notes-123', form: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
          { key: 'case-notes-456', form: { value: { id: 2 }, expiresAfter: expect.any(Number) } },
        ]),
      );
    });

    test('should skip keys where getForm returns null', () => {
      LocalFormCache.saveForm('foo1', { id: 1 });
      LocalFormCache.saveForm('foo2', null as unknown as object);

      const pattern = /^foo/;
      const result = LocalFormCache.getFormsByPattern(pattern);

      expect(result).toHaveLength(1);
      expect(result).toEqual([
        { key: 'foo1', form: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
      ]);
    });
  });
});
