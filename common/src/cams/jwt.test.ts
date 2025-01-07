import { isCamsJwt } from './jwt';

describe('jwt model', () => {
  test('isCamsJwt', () => {
    expect(isCamsJwt({ header: {}, claims: {} })).toBeTruthy();
    expect(isCamsJwt({ claims: {} })).toBeFalsy();
    expect(isCamsJwt({ header: {} })).toBeFalsy();
    expect(isCamsJwt({})).toBeFalsy();
    expect(isCamsJwt(null)).toBeFalsy();
  });
});
