import config from '../configuration/apiConfiguration';

export type CaseListResponseData = {
  message: string;
  count: number;
  body: {
    staff1Label: string;
    staff2Label: string;
    caseList: Array<object>;
  };
};

export type ResponseData = {
  message: string;
  count: number;
  body: object | Array<object>;
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

      if (response.ok) {
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
}
