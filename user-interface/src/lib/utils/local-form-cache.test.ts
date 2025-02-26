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
    expect(actual).toEqual(formData);
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
});
