async function runHttp(url: string, init: RequestInit) {
  return await fetch(url, init);
}

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

  return await runHttp(data.url, requestInit);
}

export async function httpDelete(data: { url: string; headers?: object }): Promise<Response> {
  const requestInit: RequestInit = {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    cache: 'default',
  };

  return await runHttp(data.url, requestInit);
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

  return await runHttp(data.url, requestInit);
}

export async function httpPatch(data: {
  url: string;
  body: object;
  headers?: object;
}): Promise<Response> {
  const requestInit: RequestInit = {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    body: JSON.stringify(data.body),
    cache: 'default',
  };

  return await runHttp(data.url, requestInit);
}

export async function httpPut(data: {
  url: string;
  body: object;
  headers?: object;
}): Promise<Response> {
  const requestInit: RequestInit = {
    method: 'PUT',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    body: JSON.stringify(data.body),
    cache: 'default',
  };

  return await runHttp(data.url, requestInit);
}
