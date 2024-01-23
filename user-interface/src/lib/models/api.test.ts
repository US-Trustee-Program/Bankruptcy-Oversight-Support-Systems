import { ObjectKeyVal } from '../type-declarations/basic';
import Api from './api';
import * as httpAdapter from '../utils/http.adapter';
import { vi } from 'vitest';

describe('Specific tests for the API model', () => {
  test('createPath should return a properly constructed URL when passed a basic path and an array of query parameters', () => {
    const path = '/foo/bar';
    const params: ObjectKeyVal = {
      first_name: 'John',
      last_name: 'Smith',
    };

    const result = Api.createPath(path, params);

    expect(result).toEqual('/foo/bar?first_name=John&last_name=Smith');
  });

  test('call to Post which throws any server error should reject with a 500', async () => {
    const mockHttpPost = vi.fn().mockResolvedValue(new Error('bad request'));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    await expect(Api.post('/some/path', {})).rejects.toThrow(
      '500 Error - Server Error response.json is not a function',
    );

    // Verify that the mock function was called
    expect(mockHttpPost).toHaveBeenCalled();
  });

  test('should return error message when "post" response is not ok', () => {
    const mockHttpPost = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock post' }),
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    expect(Api.post('/some/path', {})).rejects.toThrow('mock post');
  });

  test('should return 500 error message when "list" response is not ok and retuns 500', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ status: 500, message: 'mock list 500' }),
      status: 500,
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).rejects.toThrow('mock list 500');
  });

  test('should return 400 error message when "list" response is not ok and status is not 500', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock list 400' }),
      status: 400,
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).rejects.toThrow('400 Error - /some/path - mock list 400');
  });

  test('should return 500 error message when "get" response is 500', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ status: 500, message: 'mock get 500' }),
      status: 500,
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).rejects.toThrow('mock get 500');
  });

  test('should return 400 error message when "get" response is not 500', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock get 400' }),
      status: 400,
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).rejects.toThrow('400 Error - /some/path - mock get 400');
  });

  test('should throw error when "get" response is not ok', () => {
    const mockHttpGet = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'mock get ok' }),
      status: 200,
      ok: false,
    });
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).rejects.toThrow('mock get ok');
  });

  test('should throw all other "get" errors as "500" errors', () => {
    const error = new Error('something bad happened');
    const rethrownError = new Error(`500 Error - Server Error ${(error as Error).message}`);
    const mockHttpGet = vi.fn().mockRejectedValue(error);
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).rejects.toThrow(rethrownError);
  });

  test('should return expected result when "get" response is ok', () => {
    const payload = { foo: 'mock get' };
    const mockHttpGet = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      status: 200,
      ok: true,
    });
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).resolves.toEqual(payload);
  });

  test('should return data when response is Ok', () => {
    const payload = { foo: 'mock post' };
    const mockHttpPost = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      ok: true,
    });
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    expect(Api.post('/some/path', {})).resolves.toEqual(payload);
  });

  test('call to Get with a server error should reject with a 500', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => {
      throw Error('bad request');
    });
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).rejects.toThrow('500 Error - Server Error bad request');
  });

  test('call to Get with valid parameters should return with an OK', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => 'mock get',
      ok: true,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.list('/some/path', {})).resolves.toBe('mock get');
  });

  test('should throw error when "patch" response is not ok', () => {
    const mockHttpPatch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'mock get ok' }),
      status: 200,
      ok: false,
    });
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);

    expect(Api.patch('/some/path', {})).rejects.toThrow('mock get ok');
  });

  test('should throw all other "patch" errors as "500" errors', () => {
    const error = new Error('something bad happened');
    const rethrownError = new Error(`500 Error - Server Error ${(error as Error).message}`);
    const mockHttpPatch = vi.fn().mockRejectedValue(error);
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);

    expect(Api.patch('/some/path', {})).rejects.toThrow(rethrownError);
  });

  test('should return expected result when "patch" response is ok', () => {
    const payload = { foo: 'mock patch' };
    const mockHttpPatch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      status: 200,
      ok: true,
    });
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);

    expect(Api.patch('/some/path', {})).resolves.toEqual(payload);
  });

  test('should pass select query string key values to the api', () => {
    const key = 'x-ms-routing-name';
    const value = 'theValue';
    const search = `${key}=${value}`;
    const options = Api.getQueryStringsToPassthrough(search, {});
    expect(options[key]).toEqual(value);
  });

  test('should pass select query string key values to the api along with options', () => {
    const key = 'x-ms-routing-name';
    const value = 'theValue';
    const search = `${key}=${value}`;

    const passedOptions = {
      foo: 'bar',
    };
    const expectedOptions = {
      ...passedOptions,
      [key]: value,
    };
    const options = Api.getQueryStringsToPassthrough(search, passedOptions);
    expect(options).toEqual(expectedOptions);
  });
});
