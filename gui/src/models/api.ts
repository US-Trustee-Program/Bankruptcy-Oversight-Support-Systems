import config from '../configuration/apiConfiguration';

export type ResponseData = {
  message: string;
  count: number;
  body: object | Array<object>;
};

export type ResponseError = {
  message: string;
  error: object;
};

export default class Api {
  private _host = `${config.protocol}://${config.server}:${config.port}`;

  public async create(path: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(this._host + path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`500 Error - Invalid Request ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Invalid Request ${(e as Error).message}`));
    }
  }

  public async list(path: string): Promise<ResponseData> {
    try {
      const response = await fetch(this._host + path, {
        method: 'GET',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
      });

      const data = await response.json();

      console.log(response);
      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`404 Error - Not Found ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`404 Error - Not found ${(e as Error).message}`));
    }
  }

  public async read(path: string, id: string): Promise<ResponseData> {
    try {
      const response = await fetch(`${this._host}${path}/${id}`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`404 Error - Not Found ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`404 Error - Not Found ${(e as Error).message}`));
    }
  }

  public async update(path: string, id: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(`${this._host}${path}/${id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`500 Error - Failed Update ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Invalid Request ${(e as Error).message}`));
    }
  }

  public async replace(path: string, id: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(`${this._host}${path}/${id}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`500 Error - Failed Replace ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Invalid Request ${(e as Error).message}`));
    }
  }

  public async del(path: string, id: string) {
    try {
      const response = await fetch(`${this._host}${path}/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        return Promise.reject(new Error(`500 Error - Failed to Delete ${data?.toString()}`));
      }
    } catch (e: unknown) {
      return Promise.reject(new Error(`500 Error - Invalid Request ${(e as Error).message}`));
    }
  }
}
