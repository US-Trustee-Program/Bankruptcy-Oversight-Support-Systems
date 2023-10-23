import { httpGet, httpPost } from '@/utils/http.adapter';

describe('http adapter tests', () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should call fetch with expected request for httpGet with no additional headers', async () => {
    httpGet({ url: 'fake-url' });
    expect(fetchSpy).toHaveBeenCalledWith(
      'fake-url',
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

  test('should call fetch with expected request for httpGet with additional headers', async () => {
    httpGet({ url: 'fake-url', headers: { 'X-my-custom-header': 'hello-world' } });
    expect(fetchSpy).toHaveBeenCalledWith(
      'fake-url',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json;charset=UTF-8',
          'X-my-custom-header': 'hello-world',
        },
        cache: 'default',
      }),
    );
  });

  test('should call fetch with expected request for httpPost with no additional headers', async () => {
    httpPost({ url: 'fake-url', body: { a: 'a-value', b: false } });
    expect(fetchSpy).toHaveBeenCalledWith(
      'fake-url',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        cache: 'default',
      }),
    );
  });

  test('should call fetch with expected request for httpPost with additional headers', async () => {
    httpPost({
      url: 'fake-url',
      body: { a: 'a-value', b: false },
      headers: { 'X-my-custom-header': 'hello-world' },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'fake-url',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'X-my-custom-header': 'hello-world',
        },
        cache: 'default',
      }),
    );
  });
});
