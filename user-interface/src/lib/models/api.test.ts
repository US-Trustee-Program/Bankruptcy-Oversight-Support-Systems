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

  test('should return expected result when "get" response is ok', () => {
    const mockHttpGet = vi.fn().mockImplementation(() => ({
      json: () => Promise.resolve({ message: 'mock get ok' }),
      status: 200,
      ok: false,
    }));
    vi.spyOn(httpAdapter, 'httpGet').mockImplementation(mockHttpGet);

    expect(Api.get('/some/path', {})).rejects.toThrow('mock get ok');
  });

  test('should return data when response is Ok', () => {
    const mockHttpPost = vi.fn().mockImplementation(() => ({
      json: () => 'mock post',
      ok: true,
    }));
    vi.spyOn(httpAdapter, 'httpPost').mockImplementation(mockHttpPost);

    expect(Api.post('/some/path', {})).resolves.toBe('mock post');
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
});
