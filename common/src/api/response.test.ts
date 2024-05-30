import {
  buildResponseBodySuccess,
  isResponseBodyError,
  isResponseBodySuccess,
  ResponseBodySuccess,
  ResponseMetaData,
} from './response';
import { DEFAULT_SEARCH_LIMIT } from './search';

describe('response type assertion tests', () => {
  test('should identify ResponseBodySuccess true', () => {
    const response = {
      isSuccess: true,
      data: {},
    };
    expect(isResponseBodySuccess(response)).toBeTruthy();
  });

  test('should identify ResponseBodySuccess false', () => {
    const response = {
      isSuccess: false,
      error: {},
    };
    expect(isResponseBodySuccess(response)).toBeFalsy();
  });

  test('should identify ResponseBodySuccess false with bad data', () => {
    const response = {
      isSuccess: false,
      data: {},
    };
    expect(isResponseBodySuccess(response)).toBeFalsy();
  });

  test('should identify ResponseBodyError true', () => {
    const response = {
      isSuccess: false,
      error: {},
    };
    expect(isResponseBodyError(response)).toBeTruthy();
  });

  test('should identify ResponseBodyError false', () => {
    const response = {
      isSuccess: true,
      data: {},
    };
    expect(isResponseBodyError(response)).toBeFalsy();
  });

  test('should identify ResponseBodyError false with bad data', () => {
    const response = {
      isSuccess: true,
      error: {},
    };
    expect(isResponseBodyError(response)).toBeFalsy();
  });
});

describe('Helper function buildResponseBodySuccess', () => {
  type TestType = {
    name: string;
  };

  test('should return a ResponseBodySuccess type with sane defaults for an object', () => {
    const data: TestType = { name: 'Foo' };
    const expected: ResponseBodySuccess<TestType> = {
      meta: {
        isPaginated: false,
        self: 'self-link',
      },
      isSuccess: true,
      data,
    };
    const actual = buildResponseBodySuccess<TestType>(data);
    expect(actual).toEqual(expected);
  });

  test('should return a ResponseBodySuccess type with sane defaults for an array', () => {
    const data: TestType[] = [{ name: 'Foo' }];
    const expected: ResponseBodySuccess<TestType[]> = {
      meta: {
        isPaginated: true,
        count: data.length,
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        self: 'self-link',
      },
      isSuccess: true,
      data,
    };
    const actual = buildResponseBodySuccess<TestType[]>(data);
    expect(actual).toEqual(expected);
  });

  test('should return a ResponseBodySuccess type with sane defaults for an empty array', () => {
    const data: TestType[] = [];
    const expected: ResponseBodySuccess<TestType[]> = {
      meta: {
        isPaginated: true,
        count: 0,
        currentPage: 0,
        limit: DEFAULT_SEARCH_LIMIT,
        self: 'self-link',
      },
      isSuccess: true,
      data,
    };
    const actual = buildResponseBodySuccess<TestType[]>(data);
    expect(actual).toEqual(expected);
  });

  test('should return a ResponseBodySuccess type for an object with meta data override', () => {
    const data: TestType = { name: 'Foo' };
    const expected: ResponseBodySuccess<TestType> = {
      meta: {
        isPaginated: false,
        self: 'self-link',
      },
      isSuccess: true,
      data,
    };
    const meta: Partial<ResponseMetaData> = {
      isPaginated: false,
    };
    const actual = buildResponseBodySuccess<TestType>(data, meta);
    expect(actual).toEqual(expected);
  });

  test('should return a ResponseBodySuccess type for an array with meta data override', () => {
    const data: TestType[] = [{ name: 'Foo' }];
    const expected: ResponseBodySuccess<TestType[]> = {
      meta: {
        isPaginated: false,
        self: 'self-link',
      },
      isSuccess: true,
      data,
    };
    const meta: Partial<ResponseMetaData> = {
      isPaginated: false,
    };
    const actual = buildResponseBodySuccess<TestType[]>(data, meta);
    expect(actual).toEqual(expected);
  });

  test('should return a ResponseBodySuccess type with an overridden self link', () => {
    const data: TestType = { name: 'Foo' };
    const expected: ResponseBodySuccess<TestType> = {
      meta: {
        isPaginated: false,
        self: 'foo-link',
      },
      isSuccess: true,
      data,
    };
    const meta: Partial<ResponseMetaData> = {
      self: 'foo-link',
    };
    const actual = buildResponseBodySuccess<TestType>(data, meta);
    expect(actual).toEqual(expected);
  });
});
