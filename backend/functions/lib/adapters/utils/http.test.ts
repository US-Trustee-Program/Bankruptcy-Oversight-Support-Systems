import {httpGet, httpPost} from './http';

const fetchSpy = jest
  .spyOn(global, 'fetch')
  .mockImplementation((_url: URL,  requestInit: RequestInit):Promise<Response> => {
    // has to return a Promise<Response>
    return;
  });

describe('Tests out the http calls', () => {
  test('should call fetch with correct headers from httpPost', async () => {
    const expectedHeaders = { mimeType:'application/json', 'Content-Type': 'application/json',
      Accept: 'application/json' };

    const data = {
      url: 'urlString',
      body: {},
      headers: { mimeType:'application/json' }
    }
    try {
      await httpPost(data);
    } catch(e) {
      // Because we are not returning a Promise<Response> we catch the error and ignore as the test only
      //  cares about how fetch was called.
    }

    expect(fetchSpy).toHaveBeenCalledWith(data.url, expect.objectContaining({ headers: expectedHeaders }));
  });

  test('should call fetch with correct headers from httpGet', async () => {
    const expectedHeaders = { mimeType:'application/json', 'Content-Type': 'application/json',
      Accept: 'application/json' };

    const data = {
      url: 'urlString',
      headers: { mimeType:'application/json' }
    }
    try {
      await httpGet(data);
    } catch(e) {
      // Because we are not returning a Promise<Response> we catch the error and ignore as the test only
      //  cares about how fetch was called.
    }

    expect(fetchSpy).toHaveBeenCalledWith(data.url, expect.objectContaining({ headers: expectedHeaders }));
  });
});
