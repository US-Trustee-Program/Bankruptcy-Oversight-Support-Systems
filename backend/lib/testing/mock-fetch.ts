/* eslint-disable @typescript-eslint/no-unused-vars */

function notOk(body: unknown, status?: number) {
  return (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    return Promise.resolve({
      json: jest.fn().mockResolvedValue(body),
      ok: false,
      status,
    } as unknown as Response);
  };
}

function ok(body: unknown, status?: number) {
  return (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    return Promise.resolve({
      json: jest.fn().mockResolvedValue(body),
      ok: true,
      status,
    } as unknown as Response);
  };
}

function throws(error: Error) {
  return (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    return Promise.reject(error);
  };
}

export const MockFetch = {
  notOk,
  ok,
  throws,
};

export default MockFetch;
