/* eslint-disable @typescript-eslint/no-unused-vars */

function ok(body: unknown, status?: number) {
  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return Promise.resolve({
      ok: true,
      status,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response);
  };
}

function notOk(body: unknown, status?: number) {
  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return Promise.resolve({
      ok: false,
      status,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response);
  };
}

function throws(error: Error) {
  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    return Promise.reject(error);
  };
}

const MockFetch = {
  ok,
  notOk,
  throws,
};

export default MockFetch;
