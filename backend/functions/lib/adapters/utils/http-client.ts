import { HttpResponse } from '../types/http';

// fetch post
export async function httpPost(data: {
  url: string;
  body: object;
  headers?: object;
  credentials?: string;
}): Promise<HttpResponse> {
  const bodyContent = JSON.stringify(data.body);
  const response = await fetch(data.url, {
    method: 'POST',
    headers: {
      ...data.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: bodyContent,
  });
  const responseJson = await response.json();

  const httpResponse: HttpResponse = {
    data: responseJson,
    status: response.status,
    ...response,
  };

  if (response.ok) {
    return Promise.resolve(httpResponse);
  } else {
    return Promise.reject(httpResponse);
  }
}

export async function httpGet(data: {
  url: string;
  headers?: object;
  credentials?: string;
}): Promise<HttpResponse> {
  const response = await fetch(data.url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...data.headers,
    },
  });
  const responseJson = await response.json();
  const httpResponse: HttpResponse = {
    data: responseJson,
    status: response.status,
    ...response,
  };

  if (response.ok) {
    return Promise.resolve(httpResponse);
  } else {
    return Promise.reject(httpResponse);
  }
}
