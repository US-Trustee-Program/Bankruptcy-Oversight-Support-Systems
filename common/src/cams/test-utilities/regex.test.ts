import { urlRegex } from './regex';

describe('regex', () => {
  describe('urlRegex', () => {
    test('should match HTTP URL patterns', () => {
      expect(urlRegex.test('http://domain.net/')).toBeTruthy();
      expect(urlRegex.test('https://sub.domain.net/')).toBeTruthy();
      expect(urlRegex.test('ssh://secure.domain.net/')).toBeFalsy();
      expect(urlRegex.test('//cifspath/')).toBeFalsy();
    });
  });
});
