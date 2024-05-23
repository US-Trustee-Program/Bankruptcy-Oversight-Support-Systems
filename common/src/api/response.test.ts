import { isResponseBodyError, isResponseBodySuccess } from './response';

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
