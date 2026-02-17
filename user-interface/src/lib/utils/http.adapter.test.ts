import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from '@/lib/utils/http.adapter';

const url = 'fake-url';
const body = { a: 'a-value', b: false };
const headers = { 'X-my-custom-header': 'hello-world' };

describe('http adapter tests', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
  });

  test('should GET', async () => {
    httpGet({ url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
        },
        cache: 'default',
      }),
    );
  });

  test('should GET with additional headers', async () => {
    httpGet({ url, headers });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
          ...headers,
        },
        cache: 'default',
      }),
    );
  });

  test('should POST', async () => {
    httpPost({ url, body });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        cache: 'default',
      }),
    );
  });

  test('should POST with additional headers', async () => {
    httpPost({
      url,
      body,
      headers,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          ...headers,
        },
        cache: 'default',
      }),
    );
  });

  test('should DELETE', async () => {
    httpDelete({ url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
        },
        cache: 'default',
      }),
    );
  });

  test('should PATCH', async () => {
    httpPatch({ url, body });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        cache: 'default',
      }),
    );
  });

  test('should PUT', async () => {
    httpPut({ url, body });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        cache: 'default',
      }),
    );
  });
});
