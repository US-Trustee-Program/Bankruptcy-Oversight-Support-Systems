import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from '@/login/login-library';
import { checkForSessionEnd, initializeSessionEndLogout } from '@/login/session-end-logout';
import { CamsSession } from '@common/cams/session';
import MockData from '@common/cams/test-utilities/mock-data';
import { nowInSeconds } from '@common/date-helper';

describe('Session End Logout tests', () => {
  const host = 'camshost';
  const protocol = 'http:';
  const assign = vi.fn();

  const mockLocation: Location = {
    ancestorOrigins: {
      contains: vi.fn(),
      item: vi.fn(),
      length: 0,
      [Symbol.iterator]: vi.fn(),
    },
    assign,
    hash: '',
    host,
    hostname: '',
    href: '',
    origin: '',
    pathname: '',
    port: '',
    protocol,
    reload: vi.fn(),
    replace: vi.fn(),
    search: '',
  } as const;

  const logoutUri = protocol + '//' + host + LOGOUT_PATH;

  beforeEach(() => {
    // @ts-expect-error `location` is a readonly property. As this is just a test, we do not care.
    window.location = { ...mockLocation };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should redirect if session doesnt exist', () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
    checkForSessionEnd();
    expect(assign).toHaveBeenCalledWith(logoutUri);
  });

  test('should redirect if session is expired', () => {
    const oneSecondAgo = nowInSeconds() - 1000;
    const session: CamsSession = {
      accessToken: MockData.getJwt(),
      expires: oneSecondAgo,
      issuer: '',
      provider: 'mock',
      user: MockData.getCamsUser(),
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    checkForSessionEnd();
    expect(assign).toHaveBeenCalledWith(logoutUri);
  });

  test('should not redirect if session is not expired', () => {
    const tenSecondsFromNow = nowInSeconds() + 10000;
    const session: CamsSession = {
      accessToken: MockData.getJwt(),
      expires: tenSecondsFromNow,
      issuer: '',
      provider: 'mock',
      user: MockData.getCamsUser(),
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    checkForSessionEnd();
    expect(assign).not.toHaveBeenCalledWith(logoutUri);
  });

  test('should call setInterval correctly', () => {
    const tenSecondsFromNow = nowInSeconds() + 10000;
    const session: CamsSession = {
      accessToken: MockData.getJwt(),
      expires: tenSecondsFromNow,
      issuer: '',
      provider: 'mock',
      user: MockData.getCamsUser(),
    };
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    initializeSessionEndLogout(session);
    const milliseconds = 10000000;
    expect(setIntervalSpy.mock.calls[0][1]).toBeGreaterThan(milliseconds - 5);
    expect(setIntervalSpy.mock.calls[0][1]).toBeLessThan(milliseconds + 5);
  });
});
