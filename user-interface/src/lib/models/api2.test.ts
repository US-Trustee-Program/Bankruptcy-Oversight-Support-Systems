import { describe } from 'vitest';
import Api2, { extractPathFromUri, addAuthHeaderToApi } from './api2';
import apiModule from './api';
import { AttorneyUser } from '@common/cams/users';
/*
// TODO (maybe): doesn't work as is
describe('Api2', () => {
  test('should return MockApi2 when CAMS_PA11Y is set to true', async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');

    const { MockApi2 } = await import('../testing/mock-api2');
    const { Api2 } = await import('./api2');
    expect(Api2).toBe(MockApi2);
  });
});
*/

describe('extractPathFromUri', () => {
  test('should return path when given full uri with protocol, domain, and parameters', () => {
    const api = addAuthHeaderToApi();
    api.host = `https://some-domain.gov`;
    const expectedPath = '/this/is/a/path';
    const uri = `${api.host}${expectedPath}?these=are;the=params`;

    const actualPath = extractPathFromUri(uri, api);

    expect(actualPath).toEqual(expectedPath);
  });

  test('should return path when given only a path', () => {
    const api = addAuthHeaderToApi();
    api.host = '';
    const expectedPath = '/this/is/a/path';

    const actualPath = extractPathFromUri(expectedPath, api);

    expect(actualPath).toEqual(expectedPath);
  });

  test('getAttorneys', () => {});
});

describe.only('Api2 functions', () => {
  const error = new Error('TestError');
  let Api2Reloaded: typeof Api2;

  beforeAll(async () => {
    vi.stubEnv('CAMS_PA11Y', 'false');
    const Api2Module = await import('./api2');
    Api2Reloaded = Api2Module.Api2;
  });

  test('getAttorneys', async () => {
    const data = {} as AttorneyUser[];
    vi.spyOn(apiModule, 'get').mockResolvedValue({ data });
    expect((await Api2Reloaded.getAttorneys()).data).toEqual(data);
  });

  test('getAttorneys error', () => {
    vi.spyOn(apiModule, 'get').mockRejectedValue(error);
    // vi.spyOn(MockApi2, 'getAttorneys').mockRejectedValue(error);
    expect(Api2Reloaded.getAttorneys()).rejects.toThrow(error);
  });
});
