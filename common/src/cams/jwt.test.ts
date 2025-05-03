import { isCamsJwt } from './jwt';

describe('jwt model', () => {
  test('isCamsJwt', () => {
    expect(isCamsJwt({ claims: {}, header: {} })).toBeTruthy();
    expect(isCamsJwt({ claims: {} })).toBeFalsy();
    expect(isCamsJwt({ header: {} })).toBeFalsy();
    expect(isCamsJwt({})).toBeFalsy();
    expect(isCamsJwt(null)).toBeFalsy();
  });
});
