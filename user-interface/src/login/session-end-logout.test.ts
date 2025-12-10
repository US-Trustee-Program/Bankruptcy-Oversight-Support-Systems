import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from '@/login/login-library';
import { checkForSessionEnd, initializeSessionEndLogout } from '@/login/session-end-logout';
import { CamsSession } from '@common/cams/session';
import MockData from '@common/cams/test-utilities/mock-data';
import DateHelper from '@common/date-helper';

const { nowInSeconds } = DateHelper;

describe('Session End Logout tests', () => {
  const host = 'camshost';
  const protocol = 'http:';
  const assign = vi.fn();

  const mockLocation: Location = {
    assign,
    host,
    protocol,
    hash: '',
    hostname: '',
    href: '',
    origin: '',
    pathname: '',
    port: '',
    search: '',
    reload: vi.fn(),
    replace: vi.fn(),
    ancestorOrigins: {
      length: 0,
      item: vi.fn(),
      contains: vi.fn(),
      [Symbol.iterator]: vi.fn(),
    },
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
      user: MockData.getCamsUser(),
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer: '',
      expires: oneSecondAgo,
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    checkForSessionEnd();
    expect(assign).toHaveBeenCalledWith(logoutUri);
  });

  test('should not redirect if session is not expired', () => {
    const tenSecondsFromNow = nowInSeconds() + 10000;
    const session: CamsSession = {
      user: MockData.getCamsUser(),
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer: '',
      expires: tenSecondsFromNow,
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    checkForSessionEnd();
    expect(assign).not.toHaveBeenCalledWith(logoutUri);
  });

  test('should call setInterval correctly', () => {
    const tenSecondsFromNow = nowInSeconds() + 10000;
    const session: CamsSession = {
      user: MockData.getCamsUser(),
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer: '',
      expires: tenSecondsFromNow,
    };
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    initializeSessionEndLogout(session);
    const milliseconds = 10000000;
    expect(setIntervalSpy.mock.calls[0][1]).toBeGreaterThan(milliseconds - 5);
    expect(setIntervalSpy.mock.calls[0][1]).toBeLessThan(milliseconds + 5);
  });
});
