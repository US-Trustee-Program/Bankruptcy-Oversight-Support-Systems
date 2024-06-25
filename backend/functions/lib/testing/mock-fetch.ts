/* eslint-disable @typescript-eslint/no-unused-vars */

function ok(body: unknown) {
  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return Promise.resolve({
      ok: true,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response);
  };
}

function notOk(body: unknown) {
  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return Promise.resolve({
      ok: false,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response);
  };
}

function throws(error: Error) {
  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return Promise.reject(error);
  };
}

export const MockFetch = {
  ok,
  notOk,
  throws,
};

export default MockFetch;
