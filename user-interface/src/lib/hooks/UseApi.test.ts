import { vi } from 'vitest';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import {
  extractPathFromUri,
  mapFromLegacyToResponseBody,
  setApiContext,
  useApi,
  useGenericApi,
} from './UseApi';
import { LocalStorage } from '../utils/local-storage';
import { MockData } from '@common/cams/test-utilities/mock-data';

describe('UseApi Hook', () => {
  const mockSession = MockData.getCamsSession();
  vi.spyOn(LocalStorage, 'getSession').mockReturnValue(mockSession);

  test('should return the concrete API by default', () => {
    vi.stubEnv('CAMS_PA11Y', '');
    vi.resetModules();
    const actualApi = useApi();
    expect(actualApi).toEqual(Api);
  });

  test('should return the mock API by when CAMS_PA11Y env var is true', () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.resetModules();
    const actualApi = useApi();
    expect(actualApi).toEqual(MockApi);
  });

  test('should be able to set the module scoped API', () => {
    setApiContext(MockApi);
    const mock = useApi();
    expect(mock).toEqual(MockApi);

    setApiContext(Api);
    const real = useApi();
    expect(real).toEqual(Api);
  });

  test('should return ResponseBody on post', async () => {
    setApiContext(MockApi);
    const api = useGenericApi();

    const expectedResponse = {
      data: {
        good: 'data',
      },
      isSuccess: true,
      meta: {
        isPaginated: false,
        self: '',
      },
    };

    const actualResponse = await api.post('/some/path', { mock: 'success' });
    expect(actualResponse).toEqual(expectedResponse);
  });
});

describe('extractPathFromUri', () => {
  test('should return path when given full uri with protocol, domain, and parameters', () => {
    const api = useApi();
    api.host = `https://some-domain.gov`;
    const expectedPath = '/this/is/a/path';
    const uri = `${api.host}${expectedPath}?these=are;the=params`;

    const actualPath = extractPathFromUri(uri, api);

    expect(actualPath).toEqual(expectedPath);
  });

  test('should return path when given only a path', () => {
    const api = useApi();
    api.host = '';
    const expectedPath = '/this/is/a/path';

    const actualPath = extractPathFromUri(expectedPath, api);

    expect(actualPath).toEqual(expectedPath);
  });
});

describe('mapFromLegacyToResponseBody', () => {
  test('should return response as is if already of type ResponseBody', () => {
    const goodResponse = {
      data: {
        good: 'data',
      },
      isSuccess: true,
      meta: {
        isPaginated: false,
        self: '',
      },
    };

    const actualResponse = mapFromLegacyToResponseBody(goodResponse);
    expect(actualResponse).toEqual(goodResponse);
  });

  test('should throw "Cannot map legacy response" error if response format is unrecognized', () => {
    const badResponse = { foo: 'bar' };

    expect(() => {
      mapFromLegacyToResponseBody(badResponse);
    }).toThrow('Cannot map legacy response from API to new response model.');
  });

  test('should throw error if response body is an error', () => {
    const badResponse = {
      isSuccess: false,
      error: 'something happened that is bad',
    };

    expect(() => {
      mapFromLegacyToResponseBody(badResponse);
    }).toThrow('TBD Need to map the error from the response body');
  });
});
