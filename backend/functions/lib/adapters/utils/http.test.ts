import { httpPost } from "./http";

const fetchSpy = jest
  .spyOn(global, 'fetch')
  .mockImplementation((_url: URL,  requestInit: RequestInit):Promise<Response> => {
    // has to return a Promise<Response>
    return;
  });

describe('Tests out the http calls', () => {
  test('should call fetch with correct headers', async () => {
    const expectedHeaders = { mimeType:'application/json', 'Content-Type': 'application/json',
      Accept: 'application/json' };

    const data = {
      url: 'urlString',
      body: {},
      headers: { mimeType:'application/json' }
    }
    try {
      const response = await httpPost(data);
    }catch(e){
      ;
    }

    expect(fetchSpy).toHaveBeenCalledWith(data.url, expect.objectContaining(expect.objectContaining({headers: expectedHeaders})));
  });
});