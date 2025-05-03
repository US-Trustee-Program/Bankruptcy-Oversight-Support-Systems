import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from '@/lib/utils/http.adapter';

const url = 'fake-url';
const body = { a: 'a-value', b: false };
const headers = { 'X-my-custom-header': 'hello-world' };

describe('http adapter tests', () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should GET', async () => {
    httpGet({ url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
        },
        method: 'GET',
      }),
    );
  });

  test('should GET with additional headers', async () => {
    httpGet({ headers, url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
          ...headers,
        },
        method: 'GET',
      }),
    );
  });

  test('should POST', async () => {
    httpPost({ body, url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        method: 'POST',
      }),
    );
  });

  test('should POST with additional headers', async () => {
    httpPost({
      body,
      headers,
      url,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          ...headers,
        },
        method: 'POST',
      }),
    );
  });

  test('should DELETE', async () => {
    httpDelete({ url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
        },
        method: 'DELETE',
      }),
    );
  });

  test('should PATCH', async () => {
    httpPatch({ body, url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        method: 'PATCH',
      }),
    );
  });

  test('should PUT', async () => {
    httpPut({ body, url });
    expect(fetchSpy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        cache: 'default',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        method: 'PUT',
      }),
    );
  });
});
