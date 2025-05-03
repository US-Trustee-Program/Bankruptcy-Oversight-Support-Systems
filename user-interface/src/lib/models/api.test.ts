import { vi } from 'vitest';

import { ObjectKeyVal } from '../type-declarations/basic';
import * as httpAdapter from '../utils/http.adapter';
import Api, { addApiAfterHook, addApiBeforeHook } from './api';

describe('Specific tests for the API model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should call before and after hooks', async () => {
    const beforeHook = vi.fn();
    addApiBeforeHook(beforeHook);

    const afterHook = vi.fn();
    addApiAfterHook(afterHook);

    const mockHttpPost = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ status: 201 }),
      ok: true,
      status: 201,
      text: () => Promise.resolve(JSON.stringify({ status: 201 })),
    }));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    await Api.post('/some/path', {});

    expect(beforeHook).toHaveBeenCalled();
    expect(afterHook).toHaveBeenCalled();
  });

  test('createPath should return a properly constructed URL when passed a basic path and an array of query parameters', () => {
    const path = '/foo/bar';
    const params: ObjectKeyVal = {
      first_name: 'John',
      last_name: 'Smith',
    };

    const result = Api.createPath(path, params);

    expect(result).toEqual('/foo/bar?first_name=John&last_name=Smith');
  });

  // GET

  test('should return 500 error message when GET response is 500', async () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock get 500', status: 500 }),
      ok: false,
      status: 500,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    await expect(Api.get('/some/path', {})).rejects.toThrow('mock get 500');
  });

  test('should return 400 error message when GET response is not 500', async () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock get 400' }),
      ok: false,
      status: 400,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    await expect(Api.get('/some/path', {})).rejects.toThrow(
      '400 Error - /some/path - mock get 400',
    );
  });

  test('should throw error when GET response is not ok', async () => {
    const mockHttpGet = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'mock get ok' }),
      ok: false,
      status: 200,
    });
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    await expect(Api.get('/some/path', {})).rejects.toThrow('mock get ok');
  });

  test('should throw all other GET errors as "500" errors', async () => {
    const error = new Error('something bad happened');
    const rethrownError = new Error(`500 Error - Server Error ${(error as Error).message}`);
    const mockHttpGet = vi.fn().mockRejectedValue(error);
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    await expect(Api.get('/some/path', {})).rejects.toThrow(rethrownError);
  });

  test('should return expected result when GET response is ok', () => {
    const payload = { foo: 'mock get' };
    const mockHttpGet = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      ok: true,
      status: 200,
    });
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).resolves.toEqual(payload);
  });

  // POST

  test('call to POST which throws any server error should reject with a 500', async () => {
    const mockHttpPost = vi.fn().mockResolvedValue(new Error('bad request'));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    await expect(Api.post('/some/path', {})).rejects.toThrow(
      '500 Error - Server Error response.json is not a function',
    );

    // Verify that the mock function was called
    expect(mockHttpPost).toHaveBeenCalled();
  });

  test('should return error message when POST response is not ok', async () => {
    const mockHttpPost = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock post' }),
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    await expect(Api.post('/some/path', {})).rejects.toThrow('mock post');
  });

  test('should return data when POST response is Ok with a payload', () => {
    const payload = { foo: 'mock post' };
    const mockHttpPost = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      ok: true,
      text: () => Promise.resolve(JSON.stringify(payload)),
    });
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    expect(Api.post('/some/path', {})).resolves.toEqual(payload);
  });

  test('should return data when POST response is Ok without a payload', () => {
    const mockHttpPost = vi.fn().mockResolvedValue({
      json: () => JSON.parse(''),
      ok: true,
      text: () => Promise.resolve('{'),
    });
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);
    expect(Api.post('/some/path', {})).resolves.toBeUndefined();
  });

  // PUT

  test('call to PUT which throws any server error should reject with a 500', async () => {
    const mockHttpPut = vi.fn().mockResolvedValue(new Error('bad request'));
    vi.spyOn(httpAdapter, 'httpPut').mockImplementation(mockHttpPut);

    await expect(Api.put('/some/path', {})).rejects.toThrow(
      '500 Error - Server Error response.json is not a function',
    );

    // Verify that the mock function was called
    expect(mockHttpPut).toHaveBeenCalled();
  });

  test('should return error message when PUT response is not ok', async () => {
    const mockHttpPut = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock put' }),
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpPut').mockImplementation(mockHttpPut);

    await expect(Api.put('/some/path', {})).rejects.toThrow('mock put');
  });

  test('should return data when PUT response is Ok with a payload', () => {
    const payload = { foo: 'mock post' };
    const mockHttpPut = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      ok: true,
      text: () => Promise.resolve(JSON.stringify(payload)),
    });
    vi.spyOn(httpAdapter, 'httpPut').mockImplementation(mockHttpPut);

    expect(Api.put('/some/path', {})).resolves.toEqual(payload);
  });

  test('should return data when PUT response is Ok without a payload', () => {
    const mockHttpPut = vi.fn().mockResolvedValue({
      json: () => JSON.parse(''),
      ok: true,
      text: () => Promise.resolve('{'),
    });
    vi.spyOn(httpAdapter, 'httpPut').mockImplementation(mockHttpPut);
    expect(Api.put('/some/path', {})).resolves.toBeUndefined();
  });

  // PATCH

  test('should throw error when PATCH response is not ok', async () => {
    const mockHttpPatch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'mock patch ok' }),
      ok: false,
      status: 200,
    });
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);

    await expect(Api.patch('/some/path', {})).rejects.toThrow('mock patch ok');
  });

  test('should throw all other PATCH errors as "500" errors', async () => {
    const error = new Error('something bad happened');
    const rethrownError = new Error(`500 Error - Server Error ${(error as Error).message}`);
    const mockHttpPatch = vi.fn().mockRejectedValue(error);
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);

    await expect(Api.patch('/some/path', {})).rejects.toThrow(rethrownError);
  });

  test('should return expected result when PATCH response is ok', () => {
    const payload = { foo: 'mock patch' };
    const mockHttpPatch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    });
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);

    expect(Api.patch('/some/path', {})).resolves.toEqual(payload);
  });

  test('should return data when PATCH response is Ok without a payload', () => {
    const mockHttpPatch = vi.fn().mockResolvedValue({
      json: () => JSON.parse(''),
      ok: true,
      text: () => Promise.resolve('{'),
    });
    vi.spyOn(httpAdapter, 'httpPatch').mockImplementation(mockHttpPatch);
    expect(Api.patch('/some/path', {})).resolves.toBeUndefined();
  });

  // DELETE

  test('should throw error when DELETE response is not ok', async () => {
    const mockHttpDelete = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'mock delete ok' }),
      ok: false,
      status: 200,
    });
    vi.spyOn(httpAdapter, 'httpDelete').mockImplementation(mockHttpDelete);

    await expect(Api.delete('/some/path')).rejects.toThrow('mock delete ok');
  });

  test('should throw all other DELETE errors as "500" errors', async () => {
    const error = new Error('something bad happened');
    const rethrownError = new Error(`500 Error - Server Error ${(error as Error).message}`);
    const mockHttpDelete = vi.fn().mockRejectedValue(error);
    vi.spyOn(httpAdapter, 'httpDelete').mockImplementation(mockHttpDelete);

    await expect(Api.delete('/some/path')).rejects.toThrow(rethrownError);
  });

  test('should return expected result when DELETE response is ok', () => {
    const payload = { foo: 'mock patch' };
    const mockHttpDelete = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(payload),
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    });
    vi.spyOn(httpAdapter, 'httpDelete').mockImplementation(mockHttpDelete);

    expect(Api.delete('/some/path')).resolves.toEqual(payload);
  });

  test('should return data when DELETE response is Ok without a payload', () => {
    const mockHttpDelete = vi.fn().mockResolvedValue({
      json: () => JSON.parse(''),
      ok: true,
      text: () => Promise.resolve('{'),
    });
    vi.spyOn(httpAdapter, 'httpDelete').mockImplementation(mockHttpDelete);
    expect(Api.delete('/some/path')).resolves.toBeUndefined();
  });

  test('should pass select query string key values to the api', () => {
    const key = 'x-ms-routing-name';
    const value = 'theValue';
    const search = `${key}=${value}`;
    const options = Api.getQueryStringsToPassThrough(search, {});
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
    const options = Api.getQueryStringsToPassThrough(search, passedOptions);
    expect(options).toEqual(expectedOptions);
  });
});
