import { httpGet, httpPost } from './http-client';
import { HttpResponse } from '../types/http';

const fetchSpy = jest
  .spyOn(global, 'fetch')
  .mockImplementation((_url: URL, _requestInit: RequestInit): Promise<Response> => {
    // has to return a Promise<Response>
    return Promise.resolve({
      ok: true,
      json: jest.fn().mockImplementation(async () => {
        return JSON.parse('{ "responsejson":"testdata" }');
      }),
    } as unknown as Response);
  });

describe('Tests out the http calls', () => {
  test('should call fetch with correct headers from httpPost', async () => {
    const expectedHeaders = {
      mimeType: 'application/json',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const data = {
      url: 'urlString',
      body: {},
      headers: { mimeType: 'application/json' },
    };
    try {
      await httpPost(data);
    } catch (e) {
      // Because we are not returning a Promise<Response> we catch the error and ignore as the test only
      //  cares about how fetch was called.
    }

    expect(fetchSpy).toHaveBeenCalledWith(
      data.url,
      expect.objectContaining({ headers: expectedHeaders }),
    );
  });

  test('should call fetch with correct headers from httpGet', async () => {
    const expectedHeaders = {
      mimeType: 'application/json',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const data = {
      url: 'urlString',
      headers: { mimeType: 'application/json' },
    };
    let response: HttpResponse = {} as HttpResponse;
    try {
      response = await httpGet(data);
      console.log(response);
    } catch (e) {
      console.log('Into Catch block');
      // Because we are not returning a Promise<Response> we catch the error and ignore as the test only
      //  cares about how fetch was called.
    }

    expect(fetchSpy).toHaveBeenCalledWith(
      data.url,
      expect.objectContaining({ headers: expectedHeaders }),
    );
    expect(response.ok).toEqual(true);
    expect(response.data).toEqual({ responsejson: 'testdata' });
  });

  test('should reject when httpPost does not return response.ok', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: jest.fn().mockImplementation(async () => {
          return JSON.parse('{ "responsejson":"testdata" }');
        }),
      } as unknown as Response),
    );

    const data = {
      url: 'urlString',
      body: {},
      headers: { mimeType: 'application/json' },
    };

    try {
      await httpPost(data);
    } catch (e) {
      expect(e).toMatchObject({ ok: false });
    }
  });

  test('should reject when httpGet does not return response.ok', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: jest.fn().mockImplementation(async () => {
          return JSON.parse('{ "responsejson":"testdata" }');
        }),
      } as unknown as Response),
    );

    const data = {
      url: 'urlString',
      headers: { mimeType: 'application/json' },
    };

    try {
      await httpGet(data);
    } catch (e) {
      expect(e.ok).toBeFalsy();
    }
  });
});
