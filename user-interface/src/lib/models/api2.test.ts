import { describe } from 'vitest';

describe('Api2', () => {
  test.skip('should return MockApi2 when CAMS_PA11Y is set to true', () => {});
});

// describe('extractPathFromUri', () => {
//   test('should return path when given full uri with protocol, domain, and parameters', () => {
//     const api = useApi();
//     api.host = `https://some-domain.gov`;
//     const expectedPath = '/this/is/a/path';
//     const uri = `${api.host}${expectedPath}?these=are;the=params`;

//     const actualPath = extractPathFromUri(uri, api);

//     expect(actualPath).toEqual(expectedPath);
//   });

//   test('should return path when given only a path', () => {
//     const api = useApi();
//     api.host = '';
//     const expectedPath = '/this/is/a/path';

//     const actualPath = extractPathFromUri(expectedPath, api);

//     expect(actualPath).toEqual(expectedPath);
//   });
// });
