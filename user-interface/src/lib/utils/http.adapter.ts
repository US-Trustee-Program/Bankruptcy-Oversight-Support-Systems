export async function httpDelete(data: { headers?: object; url: string }): Promise<Response> {
  const requestInit: RequestInit = {
    cache: 'default',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    method: 'DELETE',
  };

  return await runHttp(data.url, requestInit);
}

export async function httpGet(data: { headers?: object; url: string }): Promise<Response> {
  const requestInit: RequestInit = {
    cache: 'default',
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    method: 'GET',
  };

  return await runHttp(data.url, requestInit);
}

export async function httpPatch(data: {
  body: object;
  headers?: object;
  url: string;
}): Promise<Response> {
  const requestInit: RequestInit = {
    body: JSON.stringify(data.body),
    cache: 'default',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    method: 'PATCH',
  };

  return await runHttp(data.url, requestInit);
}

export async function httpPost(data: {
  body: object;
  headers?: object;
  url: string;
}): Promise<Response> {
  const requestInit: RequestInit = {
    body: JSON.stringify(data.body),
    cache: 'default',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    method: 'POST',
  };

  return await runHttp(data.url, requestInit);
}

export async function httpPut(data: {
  body: object;
  headers?: object;
  url: string;
}): Promise<Response> {
  const requestInit: RequestInit = {
    body: JSON.stringify(data.body),
    cache: 'default',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      ...data.headers,
    },
    method: 'PUT',
  };

  return await runHttp(data.url, requestInit);
}

async function runHttp(url: string, init: RequestInit) {
  return await fetch(url, init);
}
