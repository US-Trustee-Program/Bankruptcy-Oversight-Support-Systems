import config from '../configuration/apiConfiguration';

export type CaseListBody = {
  staff1Label: string;
  staff2Label: string;
  caseList: Array<object>;
}

export type ResponseData = {
  message: string;
  count: number;
  body: object | Array<object> | CaseListBody;
};

export type ResponseError = {
  message: string;
  error: object;
};

export type ObjectKeyVal = {
  [key: string]: string | number;
};

export default class Api {
  private static _host = `${config.protocol}://${config.server}:${config.port}${
    config.basePath ?? ''
  }`;

  public static createPath(path: string, params: ObjectKeyVal) {
    if (params && Object.keys(params).length > 0) {
      const paramArr: string[] = [];
      Object.entries(params).forEach(([key, value]) => {
        paramArr.push(`${key}=${value}`);
      });
      path += '?' + paramArr.join('&');
    }
    return path;
  }

  public static async post(path: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(Api._host + path, {
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

  public static async create(path: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(Api._host + path, {
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

  public static async list(path: string, options: ObjectKeyVal): Promise<ResponseData> {
    try {
      const pathStr = Api.createPath(path, options);
      const response = await fetch(Api._host + pathStr, {
        method: 'GET',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
      });

      const data = await response.json();

      console.log(response);
      if (response.ok) {
        console.log('Response was OK');
        console.log(data);
        return data;
      } else {
        return Promise.reject(
          new Error(`404 Error - Not Found ${data?.toString()} - Response was not OK`),
        );
      }
    } catch (e) {
      console.error(e);
      return Promise.reject(
        new Error(`404 Error - Not found ${(e as Error).message} - caught error`),
      );
    }
  }

  public static async read(path: string, id: string): Promise<ResponseData> {
    try {
      const response = await fetch(`${Api._host}${path}/${id}`, {
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

  public static async update(path: string, id: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(`${Api._host}${path}/${id}`, {
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

  public static async replace(path: string, id: string, body: object): Promise<ResponseData> {
    try {
      const response = await fetch(`${Api._host}${path}/${id}`, {
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

  public static async del(path: string, id: string) {
    try {
      const response = await fetch(`${Api._host}${path}/${id}`, {
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
