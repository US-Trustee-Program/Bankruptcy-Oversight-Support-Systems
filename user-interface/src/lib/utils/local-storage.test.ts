import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from './local-storage';

const testSession = MockData.getCamsSession();
const { LAST_INTERACTION_KEY, LOGIN_LOCAL_STORAGE_ACK_KEY, LOGIN_LOCAL_STORAGE_SESSION_KEY } =
  LocalStorage;

describe('Local storage', () => {
  describe('getAck', () => {
    test('should return ack from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_ACK_KEY, 'true');
      const ack = LocalStorage.getAck();
      expect(ack).toEqual(true);
    });

    test('should return false by default from local storage', () => {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
      const ack = LocalStorage.getAck();
      expect(ack).toEqual(false);
    });
  });

  describe('setAck', () => {
    test('should set ack in local storage if ack is true', () => {
      LocalStorage.setAck(true);
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toEqual('true');
    });
    test('should remove ack from local storage if ack is false', () => {
      LocalStorage.setAck(false);
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toBeNull();
    });
  });

  describe('removeAck', () => {
    test('should remove ack from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_ACK_KEY, 'true');
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toEqual('true');
      LocalStorage.removeAck();
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toBeNull();
    });
  });

  describe('getSession', () => {
    test('should return session from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(testSession));
      const session = LocalStorage.getSession();
      expect(session).toEqual(testSession);
    });

    test('should return null if the JSON is malformed', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, '{ bad: json}');
      const session = LocalStorage.getSession();
      expect(session).toBeNull();
    });

    test('should return null from local storage if a session does not exist', () => {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      const session = LocalStorage.getSession();
      expect(session).toBeNull();
    });
  });

  describe('setSession', () => {
    test('should set session in local storage', () => {
      LocalStorage.setSession(testSession);
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY)).toEqual(
        JSON.stringify(testSession),
      );
    });
  });

  describe('removeSession', () => {
    test('should remove a session from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(testSession));
      LocalStorage.removeSession();

      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY)).toBeNull();
    });
  });

  describe('renewing token tests', () => {
    const RENEWING_TOKEN = 'cams:renewing-token';

    beforeEach(() => {
      window.localStorage.removeItem(RENEWING_TOKEN);
    });

    test('should return true if cams:renewing-token is true', () => {
      window.localStorage.setItem(RENEWING_TOKEN, 'true');
      expect(LocalStorage.isTokenBeingRenewed()).toEqual(true);
    });

    test('should return false if cams:renewing-token is not set', () => {
      expect(LocalStorage.isTokenBeingRenewed()).toEqual(false);
    });

    test('should return false if cams:renewing-token is false', () => {
      window.localStorage.setItem(RENEWING_TOKEN, 'false');
      expect(LocalStorage.isTokenBeingRenewed()).toEqual(false);
    });

    test('should set cams:renewing-token to true if it is not set', () => {
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toBeNull();
      LocalStorage.setRenewingToken();
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toEqual('true');
    });

    test('should set cams:renewing-token to true if it is set to false', () => {
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toBeNull();
      window.localStorage.setItem(RENEWING_TOKEN, 'false');
      LocalStorage.setRenewingToken();
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toEqual('true');
    });

    test('should not set cams:renewing-token if it is set to true', () => {
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toBeNull();
      window.localStorage.setItem(RENEWING_TOKEN, 'true');
      const result = LocalStorage.setRenewingToken();
      expect(result).toEqual(false);
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toEqual('true');
    });

    test('should remove cams:renewing-token if set', () => {
      window.localStorage.setItem(RENEWING_TOKEN, 'true');
      LocalStorage.removeRenewingToken();
      expect(window.localStorage.getItem(RENEWING_TOKEN)).toBeNull();
    });
  });

  describe('getLastInteraction', () => {
    test('should return a timestamp', () => {
      window.localStorage.setItem(LAST_INTERACTION_KEY, '100');
      const actual = LocalStorage.getLastInteraction();
      expect(actual).toEqual(100);
    });

    test('should return null if the timestamp is not set', () => {
      window.localStorage.removeItem(LAST_INTERACTION_KEY);
      const actual = LocalStorage.getLastInteraction();
      expect(actual).toEqual(null);
    });

    test('should return null if the timestamp was not set to an integer', () => {
      window.localStorage.setItem(LAST_INTERACTION_KEY, 'Z');
      const actual = LocalStorage.getLastInteraction();
      expect(actual).toEqual(null);
    });
  });

  describe('setLastInteraction', () => {
    test('should set a timestamp', () => {
      LocalStorage.setLastInteraction(100);
      expect(window.localStorage.getItem(LAST_INTERACTION_KEY)).toEqual('100');
    });
  });
});
