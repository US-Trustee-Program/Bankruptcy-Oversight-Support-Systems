export async function httpGet(data: { url: string; headers?: object }): Promise<Response> {
  const requestInit: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    cache: 'default',
  };

  return await fetch(data.url, requestInit);
}

export async function httpPost(data: {
  url: string;
  body: object;
  headers?: object;
}): Promise<Response> {
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    body: JSON.stringify(data.body),
    cache: 'default',
  };

  return await fetch(data.url, requestInit);
}
